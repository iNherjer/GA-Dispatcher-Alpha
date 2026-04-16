#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
PORT="${1:-8080}"
URL="http://127.0.0.1:${PORT}/index.html"

cd "$ROOT_DIR"
echo "[GA Dispatcher] Starte lokalen HTTP-Server in: $ROOT_DIR"
echo "[GA Dispatcher] URL: $URL"

if command -v python3 >/dev/null 2>&1; then
  (sleep 1; open "$URL" >/dev/null 2>&1 || true) &
  exec python3 -m http.server "$PORT" --bind 127.0.0.1
elif command -v python >/dev/null 2>&1; then
  (sleep 1; open "$URL" >/dev/null 2>&1 || true) &
  exec python -m SimpleHTTPServer "$PORT"
else
  echo "[GA Dispatcher] Fehler: Weder python3 noch python gefunden."
  exit 1
fi
