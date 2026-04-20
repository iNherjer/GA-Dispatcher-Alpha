#!/bin/bash

# 1. Erweitert den Suchpfad (PATH), damit der Mac Node.js und npx findet!
export PATH="/usr/local/bin:/opt/homebrew/bin:~/.npm-global/bin:$PATH"

# 2. Wechselt in das Verzeichnis, in dem dieses Skript liegt
cd "$(dirname "$0")"

echo "====================================="
echo "🛠️ Baue GA-Tracker.exe für Windows..."
echo "====================================="

# 3. Wir nutzen 'npx pkg' statt nur 'pkg'. Das ist deutlich robuster!
npx pkg tracker.js --targets node18-win-x64 --output VFR-Multitool-Tracker.exe

echo ""
echo "✅ Fertig! Die Exe-Datei wurde erstellt."
echo ""

read -p "Drücke ENTER, um das Fenster zu schließen..."
