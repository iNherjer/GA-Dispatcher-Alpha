# Tracker v665 Alpha – Crew-Live bleibt verbunden

Der Tracker liefert EFB-Webassets mit Revision 66501. Der zugehörige Web-Cache ist v2565.

- **Crew-Live-Keepalive** (`tracker-crew-live.js`): Der Tracker pingt den Crew-Raum alle 30 s mit
  `{"type":"crew_ping"}`. Das Relay antwortet per `setWebSocketAutoResponse` mit `{"type":"crew_pong"}`, ohne den
  Raum zu wecken (ga-relay `d5276fad`, seit 26.11.2026 live). Kommt 75 s lang nichts an, trennt der Tracker
  (`CREW_LIVE_STALE`) und tritt sofort neu bei.
  Anlass: Ortis Log (v664, 26.11.2026). Beitritt um 18:45 UTC, ein Zuschauer um 18:56 wurde noch gesehen, danach
  blieb es still, ohne `CREW_LIVE_CLOSED`. Die Zuschauer von 20:32 bis 20:48 UTC kamen nicht mehr an, die App zeigte
  „0 Tracker im Crew-Raum“. Ohne Zuschauer sendet der Tracker nichts, die stumme Leitung starb unbemerkt.
  SALUD (19.11.) zeigte dasselbe Bild.
- **Neue Logzeilen:** `CREW_LIVE_STATE` (beim Start, dann alle 10 min: verbunden, beigetreten, Tracker, Zuschauer,
  sendet), `CREW_LIVE_DISABLED` (fehlende Pilot-ID oder PIN), `CREW_LIVE_IDLE reason=no-crew`.
- **Relay-Beitritt** (serverseitig, schon live): Nachrichten während der PIN-Prüfung warten auf den Beitritt. Der
  Fehlstart der Cloudflare-Verbindung direkt nach dem Tracker-Start (öffnet, schließt nach 0,1 s) sollte damit
  entfallen.
- **EFB-Assets:** englische Texte der Dispatch-Rückfrage (Web v2564), Stile des versteckten Geräte-GPS-Modus (im EFB
  ohne Wirkung) und die Umweg-Beschriftung im Höhenprofil aus der Queue.

## Im Simulator prüfen

- Zwei Crew-Mitglieder mit v665: Nach einer längeren Flugphase ohne Zuschauer öffnet einer die Weltkarte im Web. Der
  andere erscheint grün auf der Karte, das Debug-Fenster zeigt „Im Crew-Raum: 1 Tracker“.
- Tracker-Log: `CREW_LIVE_STATE … joined=1` alle 10 min, keine Schleife aus `CREW_LIVE_STALE`.

## Tests

- Tracker-Gesamtlauf: 1647 bestanden, 2 übersprungen, 0 Fehler (neu: Keepalive und Abschaltgrund in
  `tracker-crew-live.test.js`).
- Relay: `relay-worker.test.mjs` (Beitritts-Warteschlange), `crew-live-room.test.mjs` (Pong). Pong live gegen
  `ga-relay` geprüft.

## Artefakt

- [Tracker v665 Alpha](https://github.com/iNherjer/GA-Dispatcher-Alpha/releases/tag/v665)
  aus Commit `275cf14fd`. Windows-x64-EXE mit 177237530 Bytes.
- SHA-256 `2885a2946c962de624d39e00e4a39cde56215f96bdda662120f7e741559bcad3`.
- Öffentlicher Download bytegenau geprüft. Aktivierung im Tracker-Alpha-Kanal.
