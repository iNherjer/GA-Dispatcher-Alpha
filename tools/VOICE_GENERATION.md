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
