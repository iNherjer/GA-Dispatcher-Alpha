#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== GA Dispatcher | ElevenLabs Voice Pack Generator ==="
echo

if ! command -v node >/dev/null 2>&1; then
  echo "Fehler: Node.js wurde nicht gefunden."
  echo "Bitte Node.js installieren und erneut starten."
  read -r -p "ENTER zum Beenden..."
  exit 1
fi

if [[ -z "${ELEVENLABS_API_KEY:-}" ]]; then
  echo "ElevenLabs API Key nicht gesetzt."
  read -r -s -p "Bitte ELEVENLABS_API_KEY eingeben (leer = aus Zwischenablage): " ELEVENLABS_API_KEY
  echo
  if [[ -z "${ELEVENLABS_API_KEY:-}" ]] && command -v pbpaste >/dev/null 2>&1; then
    ELEVENLABS_API_KEY="$(pbpaste)"
  fi
  export ELEVENLABS_API_KEY
fi

# Key robust bereinigen (häufige Copy/Paste-Varianten)
ELEVENLABS_API_KEY="$(printf '%s' "${ELEVENLABS_API_KEY:-}" \
  | tr -d '\r' \
  | sed -E 's/^[[:space:]]+|[[:space:]]+$//g' \
  | sed -E 's/^(ELEVENLABS_API_KEY|xi-api-key)[[:space:]]*=[[:space:]]*//I' \
  | sed -E 's/^"(.*)"$/\1/; s/^'\''(.*)'\''$/\1/')"
export ELEVENLABS_API_KEY

if [[ -z "${ELEVENLABS_API_KEY:-}" ]]; then
  echo "Fehler: Key ist leer."
  read -r -p "ENTER zum Beenden..."
  exit 1
fi

# Vorab-Check: ist der Key gültig?
if command -v curl >/dev/null 2>&1; then
  TMP_OUT="$(mktemp /tmp/el-test-XXXXXX.mp3)"
  # TTS-Test — funktioniert auch bei reinen TTS-Keys (kein user_read nötig)
  HTTP_CODE="$(curl -sS -o "$TMP_OUT" -w "%{http_code}" \
    -X POST "https://api.elevenlabs.io/v1/text-to-speech/XrExE9yKIg1WjnnlVkGX" \
    -H "xi-api-key: ${ELEVENLABS_API_KEY}" \
    -H "Content-Type: application/json" \
    -d '{"text":"Test","model_id":"eleven_turbo_v2_5","voice_settings":{"stability":0.5,"similarity_boost":0.75}}' \
    || true)"
  if [[ "$HTTP_CODE" != "200" ]]; then
    echo
    echo "Fehler: ElevenLabs Key ungültig oder nicht freigeschaltet (HTTP $HTTP_CODE)."
    echo "Tipp: neuen API Key im ElevenLabs Dashboard erzeugen und exakt diesen einfügen."
    echo "Antwort (gekürzt):"
    head -c 320 "$TMP_OUT" || true
    echo
    rm -f "$TMP_OUT"
    read -r -p "ENTER zum Beenden..."
    exit 1
  fi
  rm -f "$TMP_OUT"
fi

echo
echo "Welche Packs sollen neu erzeugt werden?"
echo "1) Matilda, Hannah, Liam (empfohlen)"
echo "2) Alle konfigurierten Stimmen"
read -r -p "Auswahl [1/2, Enter=1]: " CHOICE

echo
echo "Was soll erzeugt werden?"
echo "1) Alle Clips"
echo "2) Nur problematische Kurzclips (Zahlen, zwo, Grad, fuer, Meilen, Komma, EDR, 1 Minute, Demo)"
echo "3) Nur E-DR"
echo "4) Nur 1 Minute + Demo"
read -r -p "Auswahl [1/2/3/4, Enter=1]: " CLIP_CHOICE

ARGS=(--force)
if [[ "${CHOICE:-1}" == "2" ]]; then
  echo "Starte: alle konfigurierten Stimmen..."
else
  echo "Starte: matilda,hannah,liam..."
  ARGS+=(--only matilda,hannah,liam)
fi

if [[ "${CLIP_CHOICE:-1}" == "2" ]]; then
  echo "Modus: problematische Kurzclips"
  ARGS+=(--clips aw-1min,aw-fuer,aw-grad,aw-d0,aw-d1,aw-d2,aw-d3,aw-d4,aw-d5,aw-d6,aw-d7,aw-d8,aw-d9,aw-edr,aw-komma,aw-meilen,aw-zwo,demo)
elif [[ "${CLIP_CHOICE:-1}" == "3" ]]; then
  echo "Modus: nur E-DR"
  ARGS+=(--clips aw-edr)
elif [[ "${CLIP_CHOICE:-1}" == "4" ]]; then
  echo "Modus: nur 1 Minute + Demo"
  ARGS+=(--clips aw-1min,demo)
else
  echo "Modus: alle Clips"
fi

echo
node tools/generate-elevenlabs-voice-packs.mjs "${ARGS[@]}"

echo
echo "Fertig. Voice Packs wurden erzeugt."
echo "Hinweis: Browser/PWA ggf. einmal neu laden, damit neue Clips sicher greifen."
read -r -p "ENTER zum Schließen..."
