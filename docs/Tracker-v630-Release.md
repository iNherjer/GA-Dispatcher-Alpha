# Tracker v630 Alpha – Crew-Live-Verkehr

Zusammen ausgeliefert mit Web v2360, Relay `ga-relay` und `ga-proxy` (10.11.2026).

## Hintergrund

Testflug 09.11.2026: Zwei Mitspieler (Comanche, Heli D-HGSR) waren weder im EFB noch in der
Web-App zu sehen. MSFS 2024 liefert Mitspieler nicht über SimConnect (bekannter
DevSupport-Fehler, Objekte mit Position 0). Lösung: eigener Positionsaustausch der Crew.

## Änderungen

- **ga-proxy:** `GET /api/crew-presence-v1/<crew>/live-ticket` – signiertes Ticket (2 h)
  nach Prüfung von Pilot-ID/PIN und Crew-Mitgliedschaft (Secret `CREW_LIVE_SECRET`).
- **ga-relay:** neuer Durable Object `CrewLiveRoom` (Pfad `/crew`, Migration v2), siehe
  `tools/cloudflare-relay/README.md`.
- **Tracker:** `tracker-crew-live.js` – Ticket, Verbindung, Wiederverbindung mit Backoff;
  sendet nur bei Zuhörern (anderer Crew-Tracker 2 s, nur Zuschauer 5 s), beachtet
  „Flug teilen“; Crew-Kontakte vorn in EFB- und Relay-Verkehr (`withCrewTraffic`), Symbol
  aus dem Preset (`ownCrewIconKind`), Rufzeichen aus dem Flugzeug.
- **Warnsperre** für Crew in `traffic-warning-core.js`, **grüne Anzeige** in
  `traffic-map-layer.js`, Crew vom Positions-Eigenfilter ausgenommen.
- **Web v2360:** `crew-live-client.js` als Zuschauer (nur bei sichtbarer Karte oder offener
  Crew-Flug-Detailkarte); Crew-Flugzeuge auf der Karte, Detailkarte live mit grüner Spur.
- `EFB_WEB_ASSET_REVISION` 63001.

## Geprüft

- Tracker 1554/1556 (2 übersprungen, 0 Fehler), Web 219/219, Relay alle, Worker 98/100
  (2 Follow-up-Tests schon vorher rot).
- Live: Crew-Raum antwortet, gefälschtes Ticket wird abgewiesen; Ticket-Endpunkt ohne
  Anmeldung 401.
- Browser: grüne Crew-Symbole mit Rufzeichen, Warnring.
- Mit mehreren echten Piloten im Sim noch nicht geprüft; alle brauchen v630.

Stable bleibt unverändert (v605).

## Aktivierung

_wird nach dem Build ergänzt_
