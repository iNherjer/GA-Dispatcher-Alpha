# GA Nutzer Admin

Lokales Admin-Tool fuer kompakte Sync-Nutzerlisten und Bugreport-KV-Cleanup.

## Start

Im Repo-Root:

```bash
./start-user-admin.command
```

Optional anderer Port:

```bash
./start-user-admin.command 8902
```

## Worker-Endpunkte

- `GET /api/admin/users?limit=1000`
- `POST /api/problem-reports/purge`

`./start-user-admin.command` startet standardmaessig einen lokalen Node-Proxy. Der Proxy liest per `npx wrangler` direkt aus dem Cloudflare-KV und braucht im Browser keinen Admin-Token.

Wenn die HTML-Datei ohne lokalen Proxy gegen den produktiven Worker-Endpunkt genutzt wird, nutzen beide Endpunkte den gleichen `BUG_TRACKER_ADMIN_TOKEN` wie der Bug-Tracker. Ohne Token liefert der Worker `401 Unauthorized`.

Die Nutzerliste liefert nur `id`, `name`, `registeredAt`, `lastModified` und kompakte Statusflags. PINs, Pinnwand, Logbuch und Missionsdaten werden nicht ausgegeben.

Alte Sync-Profile haben eventuell kein echtes Registrierungsdatum. Neue Profile bekommen `registeredAt` serverseitig beim ersten Sync-POST.
