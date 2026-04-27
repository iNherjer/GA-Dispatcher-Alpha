# AIP Chart Worker Endpoints

Diese Worker-Datei ergänzt den bestehenden `ga-proxy` um:

- `GET /api/aip-chart/resolve?icao=XXXX&country=YY`
- `GET /api/aip-chart/file?url=<encoded>`
- `GET /api/obstacles/tile?tile=<latIndex|lonIndex>&layer=core|poi`
- `POST /api/problem-reports` (öffentlich, Report anlegen)
- `GET /api/problem-reports?status=open&limit=120` (Admin, offene Reports)
- `GET /api/problem-reports/:id` (Admin, voller Report)
- `POST /api/problem-reports/:id/ack` (Admin, als behoben quittieren)

## Dateien

- `aip-chart-worker.js` – Endpunkt-Implementierung (Cloudflare Module Worker)
- `aip-chart-worker.test.mjs` – Fixture-Tests für Parser/Resolver-Helfer

## Lokale Tests

```bash
cd tools/cloudflare-worker
node aip-chart-worker.test.mjs
```

## Deploy (Wrangler)

```bash
cd tools/cloudflare-worker
npx wrangler whoami
npx wrangler deploy
```

Wenn `--env production` Fehler über `.../workers/services/.../environments/production` wirft:

1. Erst ohne `--env` deployen (`npx wrangler deploy`).
2. Prüfen, ob `name = "ga-proxy"` in `wrangler.toml` korrekt ist.
3. `npx wrangler login` erneuern und nochmal deployen.
4. Wrangler updaten (`npm i -g wrangler@latest` oder `npx wrangler@latest deploy`).

Hinweis:
- Der Worker nutzt `env.GA_SYNC_KV`; dafür muss ein KV-Binding `GA_SYNC_KV` im Worker vorhanden sein.
- Ohne dieses Binding liefert `/api/sync/*` einen `503` mit Hinweistext.
- Für den Bugtracker kann optional ein Secret gesetzt werden:
  - `BUG_TRACKER_ADMIN_TOKEN` (als Worker Secret, nicht als plain var)
  - Wenn kein Secret gesetzt ist, sind List/Detail/Ack-Endpoints offen.

## Pflicht-Binding für Sync

In `wrangler.toml` ergänzen (mit echter Namespace-ID):

```toml
[[kv_namespaces]]
binding = "GA_SYNC_KV"
id = "<DEINE_KV_NAMESPACE_ID>"
```

## Integration im bestehenden Worker

1. Endpunkte aus `aip-chart-worker.js` in euren Haupt-Worker übernehmen.
2. CORS-Header für Browserzugriff beibehalten.
3. Domain-Allowlist (`FILE_ALLOWED_HOSTS`) passend zu eurer Policy prüfen.
4. Optional Worker-Variablen setzen:
   - `OBSTACLE_CORE_TILES_BASE=https://raw.githubusercontent.com/<owner>/<repo>/<branch>/obstacles/core-tiles`
   - `OBSTACLE_POI_TILES_BASE=https://raw.githubusercontent.com/<owner>/<repo>/<branch>/obstacles/poi-tiles`
   - `OBSTACLE_TILES_BASE=.../obstacles/tiles` (Legacy-Fallback fuer `layer=core`)
5. Optional Bugtracker-Secret setzen:
   - `npx wrangler secret put BUG_TRACKER_ADMIN_TOKEN`
6. Deployen und im Frontend testen:
   - `loadAipChartOverlay(ICAO, country)`
   - `startAipChartCalibration()`
   - `setAipChartOpacity(value)`
   - `clearAipChartOverlay()`
