#!/bin/bash
# GA Dispatcher — Sim-Test Autostart

cd "$(dirname "$0")"

# Shell-Profile laden
[ -f ~/.zshrc ]        && source ~/.zshrc 2>/dev/null
[ -f ~/.bash_profile ] && source ~/.bash_profile 2>/dev/null
[ -f ~/.profile ]      && source ~/.profile 2>/dev/null

# Homebrew PATH explizit setzen (Apple Silicon & Intel)
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

# Node suchen
NODE_BIN=$(which node 2>/dev/null)

# Nicht gefunden → via Homebrew installieren
if [ -z "$NODE_BIN" ]; then
    echo "⚠️  Node.js nicht gefunden. Installiere via Homebrew..."
    echo ""
    /opt/homebrew/bin/brew install node
    export PATH="/opt/homebrew/bin:$PATH"
    NODE_BIN=$(which node 2>/dev/null)
fi

if [ -z "$NODE_BIN" ]; then
    echo "❌ Installation fehlgeschlagen. Bitte manuell installieren: https://nodejs.org"
    read -p "ENTER zum Beenden..."
    exit 1
fi

echo "✅ Node.js $(node -v)"
echo ""

if [ ! -d "node_modules" ]; then
    echo "📦 Installiere Abhängigkeiten (einmalig)..."
    npm install
    echo ""
fi

echo "🛫 Starte GA Dispatcher Sim-Test..."
echo ""
node sim-test.js
