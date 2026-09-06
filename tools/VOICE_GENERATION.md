# ElevenLabs Voice Packs

Dieses Projekt rendert die AWM-Snippets pro Stimme als einzelne Dateien nach:

`audio-warnings/voices/<pack-id>/aw-*.mp3`

## Voraussetzungen

- Node.js mit `fetch` (Node 18+)
- ElevenLabs API Key in der Shell:

```bash
export ELEVENLABS_API_KEY="..."
```

## Komplett neu rendern (empfohlen)

```bash
node tools/generate-elevenlabs-voice-packs.mjs --only matilda,hannah,liam,ava-en --force
```

## Nur problematische Kurzclips neu rendern

```bash
node tools/generate-elevenlabs-voice-packs.mjs --only matilda,hannah,liam --clips aw-1min,aw-fuer,aw-grad,aw-d0,aw-d1,aw-d2,aw-d3,aw-d4,aw-d5,aw-d6,aw-d7,aw-d8,aw-d9,aw-edr,aw-komma,aw-meilen,aw-zwo,demo --force
```

Nur EDR neu rendern:

```bash
node tools/generate-elevenlabs-voice-packs.mjs --only matilda,hannah,liam --clips aw-edr --force
```

Optional weitere Stimmen:

```bash
node tools/generate-elevenlabs-voice-packs.mjs --only bella,adam,callum,ivy,lily --force
```

Nur englisches Ava-Pack:

```bash
node tools/generate-elevenlabs-voice-packs.mjs --only ava-en --force
```

Falls deine API-Key-Scopes `voices_read` nicht erlauben (oder der Name nicht eindeutig ist), kannst du die Voice-ID direkt setzen:

```bash
export ELEVENLABS_AVA_VOICE_ID="deine_voice_id"
node tools/generate-elevenlabs-voice-packs.mjs --only ava-en --force
```

## Wichtige Punkte

- Zahlen werden als einzelne Clips erzeugt (`aw-d0` ... `aw-d9`).
- `2` wird explizit als `zwo` erzeugt (`aw-zwo`, plus `aw-d2` ebenfalls als `zwo`).
- Nach dem Rendern wird `audio-warnings/voices/catalog.json` automatisch aktualisiert.
- Das UI zeigt nur Packs an, deren `demo.mp3` existiert.
- Problematische Kurzwoerter werden nicht mehr nackt gerendert, sondern aus einem deutschen Traegersatz automatisch auf den letzten Sprachblock zugeschnitten.
- `ava-en` nutzt ein englisches Clip-Set bei identischen Clip-Keys (kompatibel mit der bestehenden AWM-Logik).
- Ausgabe ist `mp3_44100_128` und damit breit kompatibel (inkl. Nicht-Apple-Geraete/Browser).

# Gemini Pax Static Voice Assets

Wiederholte Pax-/Survey-Kommentare koennen als lokale Gemini-TTS-Dateien vorgerendert werden. Die Runtime prueft dann zuerst:

`audio-pax/gemini-survey-v1/catalog.json`

Wenn ein passender Clip vorhanden ist, wird er lokal abgespielt. Fehlt der Katalog oder ein Clip, faellt `passenger-voice.js` unveraendert auf Gemini TTS zurueck.

## Request-Plan ansehen

```bash
node tools/generate-gemini-pax-voice-assets.mjs --takes 2 --voices all
```

Die volle Default-Matrix rendert 10 feste Survey-Clips mit 5 Gemini-Stimmen und 2 Takes, also 100 TTS-Requests.

## Clips rendern

```bash
export GEMINI_API_KEY="..."
node tools/generate-gemini-pax-voice-assets.mjs --takes 2 --voices all --write
```

Alternativ liest das Script `GEMINI_API_KEY` aus `key.env.local`.

## Gezielt rendern

```bash
node tools/generate-gemini-pax-voice-assets.mjs --voices Kore,Leda,Aoede --clips scan_survey_area_entered,line_complete --takes 2 --write
```

## Nur Katalog aus vorhandenen Dateien neu schreiben

Nach einem abgebrochenen Quota-Lauf koennen vorhandene Takes ohne weitere API-Requests in den
Katalog aufgenommen werden:

```bash
node tools/generate-gemini-pax-voice-assets.mjs --takes 2 --voices all --clips all --catalog-only
```

## Wichtige Punkte

- Default-Modell ist `gemini-3.1-flash-tts-preview`.
- Stimmen entsprechen dem Passenger-Voice-Pool: `Charon`, `Puck`, `Kore`, `Leda`, `Aoede`.
- Gemini PCM/L16 wird als WAV gespeichert, damit der bestehende AudioContext-Player die Clips direkt decodieren kann.
- Das Script schreibt `audio-pax/gemini-survey-v1/catalog.json`; erst dieser Katalog aktiviert die lokalen Clips in der Runtime.

# Autoritative Tracker-Boarding-Voice

Wenn ein APT-Lauf spaeter den noch geschlossenen Tracker-Authority-Gate
passiert, fuehrt der Tracker `voice.boarding` aus. Die App uebergibt dabei
keinen API-Key, sondern ein begrenztes
`ga.mission-boarding-voice-recipe.v1` mit Prompt, App-Fallbacktext,
Task-Domain, Sprecher und Modellreihenfolge. Der gemeinsame
`mission-boarding-voice-core.js` wird in Browser und Node verwendet und
enthaelt insbesondere dieselben Regeln fuer Pickup-Unterdrueckung,
Cargo-only-Ansage, Training-Fallback und Voice-Rotation.

Der Tracker-Job wird ueber seine stabile `effectId` dedupliziert und lokal in
`tracker-voice-cache-v1.json` wiederanlaufbar gespeichert. Der Cache enthaelt
den aufgeloesten Text, begrenzte Provider-/Modellmetadaten und das fertige
Audio, aber weder API-Key noch Prompt. Bei PAX wird zuerst der nach demselben
App-Missionsseed gewaehlte `audio-cues/boarding_pax*.mp3`-Clip mit Gain `0.38`
und danach TTS abgespielt. Beide Streams teilen dieselbe exklusive
Playback-Lease des im Audio-Menue ausgewaehlten Geraets. Cargo-only erzeugt
die App-identische Loadmaster-Ansage ohne Pax-Cue. Fehlender Provider, Cue,
Audioclient oder Playbackfehler ist best effort und darf den Missionsstart
nicht sperren.

Dieser Schnitt ersetzt den Legacy-Pfad nicht allgemein. Im vorbereiteten
v376-Feldkandidaten ist `TRACKER_AUTHORITY_READY` fuer Standard-APT geoeffnet,
wirkt aber nur bei Alpha plus aktiviertem APT-Opt-in. Stable sowie Alpha ohne
Opt-in verwenden weiterhin die vorhandene Voice-Logik in
`passenger-voice.js`. Farewell/Deboarding ist fuer Standard-APT ebenfalls
gemeinsam extrahiert. POI-/Pickup-/Sonderansagen und der reale In-Sim-
Playbacknachweis bleiben weiterhin offen.

# Autoritative Tracker-Farewell-Voice

Der lokale Farewell-Migrationsblock verwendet
`ga.mission-farewell-voice-recipe.v1`. Das Recipe kommt aus demselben
`_farewellPreparedContext()` wie der App-Fallback und behaelt damit
Passenger-Prompt, Failure-Direkttext, Cargo-only-Prompt, Sprecher,
Task-Domain und Modellreihenfolge. Beim Close aus der vollstaendigen App/EFB
wird das situationsaktuelle Recipe nur privat an den Tracker gereicht; Prompt
und API-Key sind kein Teil der oeffentlichen Mission-Control-Projektion.

Bei PAX beginnt der zentrale Job am Deboarding-Stage `cue`. Der ausgewaehlte
Audioclient spielt zuerst `deboarding_pax*.mp3` mit Gain `0.38` und danach den
Farewell-TTS-Stream. Erst die bestaetigte oder best-effort beendete Wiedergabe
gibt `mission_scene_deboarding_continue` frei. Ein 75-Sekunden-Watchdog
entspricht dem App-End-Fallback; der abgebrochene Job wird aus dem zentralen
Cache entfernt, damit er nicht nach Missionsende verspaetet abgespielt wird.
Der Passenger-Manifeststatus bleibt bis zum finalen Deboarding-/Handoff-ACK
geladen.

Bei einem autoritativen Standard-APT-Lauf startet der Tracker die Text- und
TTS-Erzeugung bereits beim bestaetigten Touchdown am Missionsziel. Der fertige
Job bleibt bis zum spaeteren Farewell-Effekt fuer alle Playback-Clients
gesperrt und wird erst am Deboarding-Cue freigegeben. Touchdowns ausserhalb des
Zielradius, Zwischenlandungen und nicht migrierte Missionsprofile erzeugen
keinen solchen Preload.

Fuer Standard-APT erzeugt der Tracker den situationsaktuellen Kontext nun
selbst: `mission-flight-recorder-core.js` bildet App-Arming, Pause,
Reposition, GPS-VS-Smoothing, Flugaggregate, Touchdown und Cargo-Stress ab.
Die Farewell-Flugdaten werden wie in der App am Touchdown eingefroren; nach
fuenf Sekunden stabiler Zwischenlandung wird nur der Recorder fuer einen
moeglichen Folgeabschnitt zurueckgesetzt.
Der beim Handoff privat gespeicherte statische App-Kontext enthaelt Rolle,
Narrativ-, APT-, Text-, Sprecher- und Modellregeln; Record und letztes Wetter
werden privat und neustartfest im Tracker fortgeschrieben. Ein Close allein
aus der tracker-gehosteten Oberflaeche erzeugt daraus denselben aktuellen
Passenger-, Failure- oder Cargo-Prompt. Ein von der App beim Close geliefertes
aktuelles Recipe hat Vorrang, das alte Handoff-Recipe dient nur noch als
Rueckwaertskompatibilitaets-Fallback. Bei Tracker-Authority bereitet die App
selbst keinen zweiten Farewell-Job mehr vor.

Dieser lokale Block oeffnet den Authority-Gate noch nicht. Training, POI,
Bush/Pickup und SAR-Heli werden bewusst als nicht migriert abgewiesen, weil
ihre zusaetzlichen Auswertungs- und Narrativregeln noch in
`passenger-voice.js` liegen. Auch kanonisches UI und realer In-Sim-
Gesamtnachweis bleiben offen.
