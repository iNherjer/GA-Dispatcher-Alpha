#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BIND_HOST="${GA_LOCAL_HOST:-127.0.0.1}"
REQUESTED_PORT="${1:-8080}"

port_is_free() {
  ! lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

PORT="$REQUESTED_PORT"
if ! port_is_free "$PORT"; then
  PORT=""
  for candidate in {8081..8090}; do
    if port_is_free "$candidate"; then
      PORT="$candidate"
      break
    fi
  done
fi

if [[ -z "$PORT" ]]; then
  echo "[GA Dispatcher] Fehler: Kein freier Port zwischen 8080 und 8090 gefunden."
  echo "[GA Dispatcher] Bitte ein anderes Terminalfenster mit laufendem Server schliessen oder einen Port uebergeben:"
  echo "  ./start-local.command 8765"
  exit 1
fi

LAUNCH_ID="$(date +%s)"
URL="http://${BIND_HOST}:${PORT}/index.html?swBypass=1&launch=${LAUNCH_ID}"

open_browser() {
  if command -v open >/dev/null 2>&1; then
    (sleep 1; open "$URL" >/dev/null 2>&1 || true) &
  fi
}

cd "$ROOT_DIR"
echo "[GA Dispatcher] Starte lokalen HTTP-Server in: $ROOT_DIR"
if [[ "$PORT" != "$REQUESTED_PORT" ]]; then
  echo "[GA Dispatcher] Port $REQUESTED_PORT ist belegt, nutze stattdessen Port $PORT."
fi
echo "[GA Dispatcher] URL: $URL"
echo "[GA Dispatcher] Tipp: Diese localhost-URL statt file:// nutzen, damit DEP/DEST-Vorschlaege funktionieren."
echo "[GA Dispatcher] Lokaler Fresh-Start: Service Worker und Cache werden fuer diese Sitzung umgangen."

if command -v python3 >/dev/null 2>&1; then
  open_browser
  exec python3 -m http.server "$PORT" --bind "$BIND_HOST"
elif command -v python >/dev/null 2>&1; then
  open_browser
  exec python -m SimpleHTTPServer "$PORT"
else
  echo "[GA Dispatcher] Fehler: Weder python3 noch python gefunden."
  exit 1
fi
