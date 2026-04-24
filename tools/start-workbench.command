#!/bin/bash
# GA Dispatcher – Tile Workbench Starter
# Doppelklick auf diese Datei startet den Workbench-Server und öffnet den Browser.

# Ins Verzeichnis dieser Datei wechseln (funktioniert auch von externer Festplatte)
cd "$(dirname "$0")"

echo "=================================================="
echo "  GA Dispatcher – Tile Workbench"
echo "=================================================="
echo ""

# Node.js prüfen
if ! command -v node &> /dev/null; then
  echo "FEHLER: Node.js nicht gefunden."
  echo "Bitte installieren: https://nodejs.org"
  read -p "Enter drücken zum Schließen..."
  exit 1
fi

# Python3 prüfen
if ! command -v python3 &> /dev/null; then
  echo "FEHLER: Python3 nicht gefunden."
  echo "Bitte installieren: https://www.python.org"
  read -p "Enter drücken zum Schließen..."
  exit 1
fi

# Port aus config lesen (default 8788)
PORT=8788

echo "Starte Server auf Port $PORT..."
echo ""
echo "Repo-Root und Cache-Pfade: siehe workbench.config.json"
echo ""

# Browser nach kurzem Delay öffnen (Server braucht ~1s zum Starten)
(sleep 1.5 && open "http://127.0.0.1:$PORT") &

# Server starten (läuft im Vordergrund, Ctrl+C zum Beenden)
node obstacle-tile-workbench-server.mjs
