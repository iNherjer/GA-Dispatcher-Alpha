#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BIND_HOST="${GA_LOCAL_HOST:-127.0.0.1}"
REQUESTED_PORT="${1:-8091}"

port_is_free() {
  ! lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

PORT="$REQUESTED_PORT"
if ! port_is_free "$PORT"; then
  PORT=""
  for candidate in {8092..8100}; do
    if port_is_free "$candidate"; then
      PORT="$candidate"
      break
    fi
  done
fi

if [[ -z "$PORT" ]]; then
  echo "[E6B Workbench] Fehler: Kein freier Port zwischen 8091 und 8100 gefunden."
  echo "[E6B Workbench] Bitte ein anderes Terminalfenster mit laufendem Server schliessen oder einen Port uebergeben:"
  echo "  ./start-e6b-workbench.command 8765"
  exit 1
fi

URL="http://${BIND_HOST}:${PORT}/tools/e6b-trace-workbench.html"

open_browser() {
  if command -v open >/dev/null 2>&1; then
    (sleep 1; open "$URL" >/dev/null 2>&1 || true) &
  fi
}

cd "$ROOT_DIR"
echo "[E6B Workbench] Starte lokalen HTTP-Server in: $ROOT_DIR"
if [[ "$PORT" != "$REQUESTED_PORT" ]]; then
  echo "[E6B Workbench] Port $REQUESTED_PORT ist belegt, nutze stattdessen Port $PORT."
fi
echo "[E6B Workbench] URL: $URL"
echo "[E6B Workbench] Ctrl+C beendet den Server."

if command -v python3 >/dev/null 2>&1; then
  open_browser
  exec python3 serve.py "$PORT" "$BIND_HOST"
else
  echo "[E6B Workbench] Fehler: python3 nicht gefunden."
  exit 1
fi
