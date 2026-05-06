#!/bin/bash
cd "$(dirname "$0")"

PORT="${1:-8789}"
URL="http://127.0.0.1:${PORT}"

echo "=================================================="
echo "  GAFOR Sector Editor (mit Push-API)"
echo "=================================================="
echo "Starte auf ${URL}"
echo ""

if ! command -v node >/dev/null 2>&1; then
  echo "FEHLER: Node.js nicht gefunden."
  read -p "Enter drücken zum Schließen..."
  exit 1
fi

(sleep 1.2 && open "${URL}" >/dev/null 2>&1 || true) &
GAFOR_EDITOR_PORT="$PORT" node gafor-sector-editor-server.mjs

