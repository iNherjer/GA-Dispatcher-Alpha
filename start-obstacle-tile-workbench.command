#!/bin/zsh
set -e

PROJECT_DIR="/Users/jofaist/Desktop/GA dispatcher alpha"
PORT="${OBS_WORKBENCH_PORT:-8788}"
URL="http://127.0.0.1:${PORT}"

cd "$PROJECT_DIR"

# Browser öffnen (best effort)
open "$URL" >/dev/null 2>&1 || true

echo "[Tile-Workbench] Starte Server auf ${URL} ..."
node tools/obstacle-tile-workbench-server.mjs
