#!/bin/zsh
set -euo pipefail

cd "$(dirname "$0")"

echo "ElevenLabs-Key wird nur fuer diese Session genutzt und nicht gespeichert."
read -s "ELEVENLABS_API_KEY?Bitte ELEVENLABS_API_KEY eingeben: "
echo ""
export ELEVENLABS_API_KEY

echo "Generiere nur Hannah aw-fuer neu..."
node tools/generate-elevenlabs-voice-packs.mjs --only hannah --clips aw-fuer --force

unset ELEVENLABS_API_KEY
echo "Fertig. Key aus der Session entfernt."
