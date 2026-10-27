#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
TOOL_DIR="$ROOT_DIR/tools/user-admin"
PORT="${1:-8900}"
URL="http://127.0.0.1:${PORT}/index.html"

if [ ! -d "$TOOL_DIR" ]; then
  echo "[Nutzer Admin] Fehler: Tool-Ordner nicht gefunden: $TOOL_DIR"
  exit 1
fi

cd "$TOOL_DIR"
echo "[Nutzer Admin] Starte lokalen Server in: $TOOL_DIR"
echo "[Nutzer Admin] URL: $URL"

if ! command -v node >/dev/null 2>&1; then
  echo "[Nutzer Admin] Node.js wird für Cloudflare-Abfragen und den sicheren Netzwerkzugriff benötigt."
  exit 1
fi

(sleep 1; open "$URL" >/dev/null 2>&1 || true) &
exec node server.mjs "$PORT"
