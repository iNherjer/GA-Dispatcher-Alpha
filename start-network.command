#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BIND_HOST="${GA_BIND_HOST:-0.0.0.0}"
REQUESTED_PORT="${1:-8080}"

port_is_free() {
  ! lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

detect_lan_ip() {
  local ip=""
  for iface in en0 en1 en2 bridge100; do
    ip="$(ipconfig getifaddr "$iface" 2>/dev/null || true)"
    if [[ -n "$ip" ]]; then
      echo "$ip"
      return 0
    fi
  done

  if command -v ifconfig >/dev/null 2>&1; then
    ip="$(ifconfig 2>/dev/null | awk '/inet / && $2 !~ /^127\./ { print $2; exit }')"
    if [[ -n "$ip" ]]; then
      echo "$ip"
      return 0
    fi
  fi

  return 1
}

detect_tailscale_ip() {
  local ip=""
  if command -v tailscale >/dev/null 2>&1; then
    ip="$(tailscale ip -4 2>/dev/null | awk '/^100\./ { print; exit }' || true)"
    if [[ -n "$ip" ]]; then
      echo "$ip"
      return 0
    fi
  fi

  if command -v ifconfig >/dev/null 2>&1; then
    ip="$(ifconfig 2>/dev/null | awk '/inet 100\./ { print $2; exit }')"
    if [[ -n "$ip" ]]; then
      echo "$ip"
      return 0
    fi
  fi

  return 1
}

PORT="$REQUESTED_PORT"
if ! port_is_free "$PORT"; then
  PORT=""
  for candidate in {8081..8090}; do
    if port_is_free "$candidate"; then
      PORT="$candidate"
      break
    fi
  done
fi

if [[ -z "$PORT" ]]; then
  echo "[GA Dispatcher] Fehler: Kein freier Port zwischen 8080 und 8090 gefunden."
  echo "[GA Dispatcher] Bitte ein anderes Terminalfenster mit laufendem Server schliessen oder einen Port uebergeben:"
  echo "  ./start-network.command 8765"
  exit 1
fi

LAN_IP="$(detect_lan_ip || true)"
TAILSCALE_IP="$(detect_tailscale_ip || true)"
LAUNCH_ID="$(date +%s)"
LOCAL_URL="http://127.0.0.1:${PORT}/index.html?swBypass=1&launch=${LAUNCH_ID}"
if [[ -n "$LAN_IP" ]]; then
  LAN_URL="http://${LAN_IP}:${PORT}/index.html?swBypass=1&launch=${LAUNCH_ID}"
else
  LAN_URL="http://DEINE-MAC-IP:${PORT}/index.html?swBypass=1&launch=${LAUNCH_ID}"
fi
if [[ -n "$TAILSCALE_IP" ]]; then
  TAILSCALE_URL="http://${TAILSCALE_IP}:${PORT}/index.html?swBypass=1&launch=${LAUNCH_ID}"
else
  TAILSCALE_URL=""
fi

if [[ "$BIND_HOST" != "0.0.0.0" && "$BIND_HOST" != "::" && "$BIND_HOST" != "127.0.0.1" && "$BIND_HOST" != "localhost" ]]; then
  LOCAL_URL="http://${BIND_HOST}:${PORT}/index.html?swBypass=1&launch=${LAUNCH_ID}"
fi

open_browser() {
  if command -v open >/dev/null 2>&1; then
    (sleep 1; open "$LOCAL_URL" >/dev/null 2>&1 || true) &
  fi
}

cd "$ROOT_DIR"
echo "[GA Dispatcher] Starte Netzwerk-Server in: $ROOT_DIR"
if [[ "$PORT" != "$REQUESTED_PORT" ]]; then
  echo "[GA Dispatcher] Port $REQUESTED_PORT ist belegt, nutze stattdessen Port $PORT."
fi
echo "[GA Dispatcher] Lokal auf diesem Mac: $LOCAL_URL"
echo "[GA Dispatcher] Im lokalen Netzwerk: $LAN_URL"
if [[ -n "$TAILSCALE_URL" ]]; then
  echo "[GA Dispatcher] Ueber Tailscale: $TAILSCALE_URL"
fi
echo "[GA Dispatcher] Andere Geraete muessen im gleichen WLAN/LAN sein."
echo "[GA Dispatcher] Fuer Tailscale muessen beide Geraete im gleichen Tailnet angemeldet sein."
echo "[GA Dispatcher] Lokaler Fresh-Start: Service Worker und Cache werden fuer diese Sitzung umgangen."
echo "[GA Dispatcher] Falls macOS fragt: eingehende Verbindungen fuer Terminal/Python erlauben."

if command -v python3 >/dev/null 2>&1; then
  open_browser
  exec python3 -m http.server "$PORT" --bind "$BIND_HOST"
elif command -v python >/dev/null 2>&1; then
  open_browser
  exec python -m SimpleHTTPServer "$PORT"
else
  echo "[GA Dispatcher] Fehler: Weder python3 noch python gefunden."
  exit 1
fi
