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
node tools/generate-elevenlabs-voice-packs.mjs --only matilda,hannah,liam --force
```

Optional weitere Stimmen:

```bash
node tools/generate-elevenlabs-voice-packs.mjs --only bella,adam,callum,ivy,lily --force
```

## Wichtige Punkte

- Zahlen werden als einzelne Clips erzeugt (`aw-d0` ... `aw-d9`).
- `2` wird explizit als `zwo` erzeugt (`aw-zwo`, plus `aw-d2` ebenfalls als `zwo`).
- Nach dem Rendern wird `audio-warnings/voices/catalog.json` automatisch aktualisiert.
- Das UI zeigt nur Packs an, deren `demo.mp3` existiert.
