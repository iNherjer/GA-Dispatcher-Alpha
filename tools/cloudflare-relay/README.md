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

## Crew-Live-Raum (seit 10.11.2026, Tracker v630)

MSFS 2024 liefert Mitspieler nicht ueber SimConnect. Jeder Tracker einer Crew
sendet deshalb seine Position in einen eigenen Crew-Raum (`CrewLiveRoom`,
Pfad `/crew?room=<sha256('crew:' + CREW)>`, Migration `v2`).

- Beitritt nur mit Ticket von `ga-proxy`
  (`GET /api/crew-presence-v1/<crew>/live-ticket`, Pilot-ID/PIN + Crew-Mitgliedschaft),
  HMAC-SHA256 mit dem Secret `CREW_LIVE_SECRET` (in **beiden** Workern identisch,
  per `wrangler secret put`). Ticket 2 h gueltig; Name/ID kommen immer aus dem Ticket.
- Nachrichten: `crew_join`, `crew_pos` (nur Tracker, Server-Drossel 800 ms, max. 2 KB,
  nur bekannte Felder), `crew_off`; Server sendet `crew_audience`, `crew_pos`, `crew_gone`.
- Tracker senden nur bei Zuhoerern: anderer Crew-Tracker 2 s, nur App-Zuschauer 5 s,
  sonst nichts; Freigabe „Flug teilen“ wird beachtet. Web-App hoert nur bei
  sichtbarer Karte bzw. offener Crew-Flug-Detailkarte zu.
- Render-Relay: kein Crew-Raum (Server-Code nicht im Repository).
