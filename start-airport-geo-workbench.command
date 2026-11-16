#!/bin/zsh
# Platz-Workbench: Karte des gemeinsamen Flugplatz-Geometrie-Vorrats (tools/airport-geo-workbench).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
TOOL_DIR="$ROOT_DIR/tools/airport-geo-workbench"
PORT="${1:-8910}"
URL="http://127.0.0.1:${PORT}/"

if ! command -v node >/dev/null 2>&1; then
  echo "[Platz-Workbench] Node.js wird benötigt (https://nodejs.org)."
  read -r "?Enter zum Schließen"
  exit 1
fi
if lsof -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "[Platz-Workbench] Läuft bereits – öffne $URL"
  open "$URL"
  exit 0
fi

cd "$TOOL_DIR"
echo "[Platz-Workbench] Starte in $TOOL_DIR"
(sleep 2; open "$URL" >/dev/null 2>&1 || true) &
exec node server.mjs "$PORT"
