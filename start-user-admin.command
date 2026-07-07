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

if command -v node >/dev/null 2>&1; then
  (sleep 1; open "$URL" >/dev/null 2>&1 || true) &
  exec node server.mjs "$PORT"
elif command -v python3 >/dev/null 2>&1; then
  echo "[Nutzer Admin] Hinweis: Python-Fallback kann nur statische Dateien ausliefern. Fuer lokale KV-Abfragen bitte Node installieren oder im Tool den Worker-Admin-Token eintragen."
  (sleep 1; open "$URL" >/dev/null 2>&1 || true) &
  exec python3 -m http.server "$PORT" --bind 127.0.0.1
elif command -v python >/dev/null 2>&1; then
  echo "[Nutzer Admin] Hinweis: Python-Fallback kann nur statische Dateien ausliefern. Fuer lokale KV-Abfragen bitte Node installieren oder im Tool den Worker-Admin-Token eintragen."
  (sleep 1; open "$URL" >/dev/null 2>&1 || true) &
  exec python -m SimpleHTTPServer "$PORT"
else
  echo "[Nutzer Admin] Fehler: Weder node noch python3/python gefunden."
  exit 1
fi
