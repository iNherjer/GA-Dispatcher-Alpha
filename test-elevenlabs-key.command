#!/bin/bash
set -euo pipefail

echo "=== ElevenLabs API Key Test ==="
echo

read -r -s -p "Bitte ELEVENLABS_API_KEY eingeben (leer = aus Zwischenablage): " KEY
echo

# Bereinigung fuer Copy/Paste-Varianten + unsichtbare Zeichen
if [[ -z "${KEY:-}" ]] && command -v pbpaste >/dev/null 2>&1; then
  KEY="$(pbpaste)"
fi

KEY="$(printf '%s' "$KEY" \
  | tr -d '\r' \
  | sed -E 's/^[[:space:]]+|[[:space:]]+$//g' \
  | sed -E 's/^(ELEVENLABS_API_KEY|xi-api-key)[[:space:]]*=[[:space:]]*//I' \
  | sed -E 's/^"(.*)"$/\1/; s/^'\''(.*)'\''$/\1/')"

if [[ -z "$KEY" ]]; then
  echo "Fehler: Key ist leer."
  read -r -p "ENTER zum Beenden..."
  exit 1
fi

KEY_LEN="${#KEY}"
KEY_HEAD="${KEY:0:8}"
KEY_TAIL="${KEY: -6}"
echo "Key-Check: Laenge=$KEY_LEN, Prefix=${KEY_HEAD}..., Suffix=...${KEY_TAIL}"

if [[ "$KEY" != sk_* ]]; then
  echo "Warnung: Der Key beginnt nicht mit 'sk_'. Das ist meist nicht der richtige Secret API Key."
fi

TMP_OUT="$(mktemp /tmp/el-test-XXXXXX.mp3)"
# TTS-Test mit Matilda-Voice (funktioniert auch bei reinen TTS-Keys)
HTTP_CODE="$(curl -sS -o "$TMP_OUT" -w "%{http_code}" \
  -X POST "https://api.elevenlabs.io/v1/text-to-speech/XrExE9yKIg1WjnnlVkGX" \
  -H "xi-api-key: $KEY" \
  -H "Content-Type: application/json" \
  -d '{"text":"Test","model_id":"eleven_turbo_v2_5","voice_settings":{"stability":0.5,"similarity_boost":0.75}}' \
  || true)"

echo
if [[ "$HTTP_CODE" == "200" ]]; then
  BYTES="$(wc -c < "$TMP_OUT" | tr -d ' ')"
  echo "OK: Key ist gültig (HTTP 200, ${BYTES} Bytes Audio empfangen)."
  rm -f "$TMP_OUT"
  read -r -p "ENTER zum Beenden..."
  exit 0
fi

echo "FEHLER: Key ungültig oder nicht freigeschaltet (HTTP $HTTP_CODE)."
echo "Antwort (gekürzt):"
head -c 500 "$TMP_OUT" || true
echo
rm -f "$TMP_OUT"
echo
echo "Tipps:"
echo "1) Im ElevenLabs Dashboard einen neuen Secret API Key erzeugen (muss mit sk_ starten)."
echo "2) Sicherstellen, dass du im richtigen Account/Workspace eingeloggt bist."
echo "3) Key ohne Leerzeichen/Anfuehrungszeichen einfuegen."
read -r -p "ENTER zum Beenden..."
