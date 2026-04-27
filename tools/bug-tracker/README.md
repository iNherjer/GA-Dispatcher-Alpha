# GA Bug Tracker (HTML)

Kleines Admin-Tool zum Anzeigen und Quittieren offener Problem-Reports.

## Start

Im Repo-Root:

```bash
./start-bug-tracker.command
```

Optional anderer Port:

```bash
./start-bug-tracker.command 8901
```

## Funktionen

- Lädt offene Reports von `/api/problem-reports?status=open`
- Markiert neue Reports mit `NEU`
- Checkbox `Behoben` quittiert den Report per `/api/problem-reports/:id/ack`
- Nach erfolgreicher Quittierung verschwindet der Report aus der Liste

## Einstellungen im Tool

- `API URL`: Standard ist der produktive Worker-Endpunkt
- `Admin Token`: optional, wird als `x-bug-admin-token` Header gesendet
- `Quittiert von`: wird in `ackedBy` gespeichert

Hinweis:
- Ist im Worker kein `BUG_TRACKER_ADMIN_TOKEN` gesetzt, funktionieren Admin-Endpoints auch ohne Token.
