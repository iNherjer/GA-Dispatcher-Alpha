#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
TOOL_DIR="$ROOT_DIR/tools/bug-tracker"
PORT="${1:-8899}"
URL="http://127.0.0.1:${PORT}/index.html"

if [ ! -d "$TOOL_DIR" ]; then
  echo "[Bug Tracker] Fehler: Tool-Ordner nicht gefunden: $TOOL_DIR"
  exit 1
fi

cd "$TOOL_DIR"
echo "[Bug Tracker] Starte lokalen Server in: $TOOL_DIR"
echo "[Bug Tracker] URL: $URL"

if command -v python3 >/dev/null 2>&1; then
  (sleep 1; open "$URL" >/dev/null 2>&1 || true) &
  exec python3 -m http.server "$PORT" --bind 127.0.0.1
elif command -v python >/dev/null 2>&1; then
  (sleep 1; open "$URL" >/dev/null 2>&1 || true) &
  exec python -m SimpleHTTPServer "$PORT"
else
  echo "[Bug Tracker] Fehler: Weder python3 noch python gefunden."
  exit 1
fi
