# GA Cloudflare Relay

Dieser Worker ist der primaere WebSocket-Transport fuer Tracker-Telemetrie. Ein
SQLite-backed Durable Object koordiniert jeweils einen gehashten Pilot-ID-Raum.
Render bleibt als unabhaengiger Fallback bestehen.

## Eigenschaften

- Hibernation-WebSockets ohne dauerhafte Timer
- Rollenrouting zwischen `tracker` und `viewer`
- serverseitige Obergrenze von etwa 2 Hz fuer kontinuierliche Telemetrie
- seltene Traffic-Snapshots umgehen die Drosselung, damit sie nicht verloren gehen
- Befehle, ACKs und Tracker-Heartbeats werden sofort weitergegeben
- Pilot-ID steht nur als SHA-256-Raumschluessel in der WebSocket-URL
- PIN wird innerhalb des Durable Objects nur als SHA-256-Vergleichswert gehalten

## Test und Deployment

```bash
cd tools/cloudflare-relay
npm test
npx wrangler deploy
```

Der erwartete Produktionsendpunkt lautet:

```text
wss://ga-relay.einherjer.workers.dev/?room=<sha256-pilot-id>
```
