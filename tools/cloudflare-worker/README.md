# AIP Chart Worker Endpoints

Diese Worker-Datei ergänzt den bestehenden `ga-proxy` um:

- `GET /api/aip-chart/resolve?icao=XXXX&country=YY`
- `GET /api/aip-chart/file?url=<encoded>`
- `GET /api/openaip/snapshot?bbox=west,south,east,north` (gemeinsamer OpenAIP-Regionscache)
- `GET /api/obstacles/tile?tile=<latIndex|lonIndex>&layer=core|poi`
- `GET /api/checklists/community` (öffentliche Checklist-Metadaten)
- `GET /api/checklists/community/:id` (öffentliche Checklist-Definition)
- `POST /api/checklists/community` (mit `X-Pilot-ID`/`X-Pilot-PIN`, veröffentlichen oder entfernen)
- `POST /api/problem-reports` (öffentlich, Report anlegen)
- `GET /api/problem-reports?status=open&limit=120` (Admin, offene Reports)
- `GET /api/problem-reports/:id` (Admin, voller Report)
- `POST /api/problem-reports/:id/ack` (Admin, als behoben quittieren)
- `POST /api/problem-reports/purge` (Admin, alte Bugreport-KV-Einträge löschen; `dryRun` standardmäßig aktiv)
- `GET /api/admin/users?limit=1000` (Admin, Sync-Nutzer kompakt anzeigen)
- `POST /api/auth/verify` (Pilot-ID/PIN prüfen und kanonische Pilot-ID zurückgeben)
- `GET /api/homebase/:pilotId` (Homebase-Plan der Pilot-ID laden)
- `POST /api/homebase/:pilotId` (Homebase-Plan mit Revisionsprüfung speichern)
- `GET /api/homebase-group/:groupName` (freigegebene Crew-Homebases der eigenen Gruppe laden)
- `GET /api/tracker/download` (stabile Weiterleitung auf den aktuellen versionierten Tracker-Release)
- `GET /api/tracker/download?format=json` (aktuelle Tracker-Version, Größe und SHA-256)

## Dateien

- `aip-chart-worker.js` – Endpunkt-Implementierung (Cloudflare Module Worker)
- `aip-chart-worker.test.mjs` – Fixture-Tests für Parser/Resolver-Helfer

## Lokale Tests

```bash
cd tools/cloudflare-worker
npm test
```

## OpenAIP-Regionscache und Rollback

Der Snapshot-Endpunkt lädt Flugplätze einschließlich Pisten, Lufträume, Navaids
einschließlich Frequenz/Kanal/Reichweite und Reporting Points für dieselbe BBox
gebündelt. Die BBox darf entsprechend der OpenAIP-Regel höchstens 5° breit und
5° hoch sein.

- identische Rasterregionen werden im Cloudflare Edge Cache standortnah zwischen Nutzern wiederverwendet;
- innerhalb der ersten fünf Minuten wird der Cache ohne OpenAIP-Abruf beantwortet;
- schlägt eine Aktualisierung fehl, kann der letzte erfolgreiche Stand bis zu 24 Stunden als `STALE` weitergegeben werden;
- fällt nur eine Sammlung aus, liefert der Worker die übrigen Daten als `PARTIAL`, hält diesen Teilstand höchstens fünf Minuten und fragt nach einer Minute gezielt nur die fehlende Sammlung erneut ab;
- `X-GA-OpenAIP-Cache` zeigt `MISS`, `HIT`, `REFRESH`, `STALE`, `PARTIAL`, `HIT-PARTIAL`, `STALE-PARTIAL` oder `ERROR`;
- die alten Catch-All-Endpunkte `/api/airports`, `/api/airspaces`, `/api/navaids` und `/api/reporting-points` bleiben unverändert erhalten.

Die App verwendet inzwischen standardmäßig die geprüften, räumlich aufgeteilten
GitHub-Pages-Daten aus `GA-Dispatcher-Aviation-Data`. Ist deren Manifest oder
ein benötigter Pack nicht erreichbar, formal ungültig oder stimmt dessen
SHA-256-Prüfsumme nicht, übernimmt automatisch dieser V2-Regionscache. Erst der
zusätzliche Modus `OpenAIP: Legacy` verwendet wieder die getrennten alten
Endpunkte.

Im Kartenmenü kann zwischen `Aviation DB: Hosted`, `OpenAIP: V2` und
`OpenAIP: Legacy` gewechselt werden. Die neue Wahl liegt in `localStorage`
unter `ga_aviation_data_mode_v3`; ein bewusst gesetzter alter Legacy-Wert unter
`ga_openaip_data_mode` wird bei der Migration respektiert. Dadurch bleiben V2
und der alte Abrufpfad als manuell wählbare Rollback-Stufen verfügbar.

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
- Ohne dieses Binding liefern `/api/sync/*` und `/api/checklists/community*` einen `503` mit Hinweistext.
- Die Checklist-Community nutzt vorhandene Sync-Profile zur PIN-Prüfung. Veröffentlichte Records speichern `ownerId`, Titel, Kapitel/Punkte, Zähler und Version, aber niemals den PIN.
- `POST /api/checklists/community` erwartet `{ "action": "publish", "checklist": { ... } }` oder `{ "action": "unpublish", "id": "..." }`.
- Für den Bugtracker kann optional ein Secret gesetzt werden:
  - `BUG_TRACKER_ADMIN_TOKEN` (als Worker Secret, nicht als plain var)
  - Wenn kein Secret gesetzt ist, sind List/Detail/Ack-Endpoints offen.
- Der Nutzer-Admin und der Bugreport-Purge nutzen denselben Admin-Token. Der Nutzer-Endpunkt liefert nur kompakte Metadaten (`id`, `name`, `registeredAt`, `lastModified`) und nie PINs, Pinnwand, Logbuch oder Missionsdaten.
- Neue Sync-Profile bekommen serverseitig `registeredAt`; alte Profile ohne dieses Feld können kein verlässliches Registrierungsdatum liefern. In der Admin-Ansicht wird dann `unbekannt` angezeigt.
- Pilot-IDs werden bei Anmeldung und Sync unabhängig von Groß-/Kleinschreibung aufgelöst. Der Auth-Endpunkt erwartet `{ "pilotId": "...", "pin": "..." }` und liefert bei Erfolg ausschließlich die kanonische `pilotId`; Profildaten und PIN werden nie zurückgegeben. Neue Pilot-IDs werden in einer einheitlichen Großschreibung gespeichert.
- Homebase-Pläne liegen getrennt unter `homebase:<pilotId>`, werden über das bestehende Pilot-Profil authentifiziert und enthalten niemals den PIN. Der Endpunkt akzeptiert höchstens 64 KiB. Schema 2 speichert Hangar, bis zu 100 Ausstattungsobjekte sowie bis zu drei Personen mit jeweils höchstens 20 Routenzielen einschließlich Zufallszielmodus und Wartezeiten atomar in demselben Plan. Bei einer veralteten `baseRevision` antwortet der Endpunkt mit HTTP 409 und dem aktuellen Cloud-Stand; `people: []` ist ab Schema 2 eine verbindliche Löschung.
- Die Crew-Ansicht prüft die anfragende Pilot-ID samt PIN sowie die aktive Mitgliedschaft im `GROUP_`-Datensatz. Der Gruppen-Endpunkt liefert die opt-in-Pläne anderer aktiver Mitglieder (`crewShareEnabled`, pro Base höchstens Hangar plus 20 Ausstattungsobjekte) und ein Crew-Verzeichnis. Nur bei aktivierter Freigabe enthält dessen Eintrag die Homebase-Startkoordinate; das Verzeichnis enthält weder PINs noch Ausstattungsobjekte.
- Für Benachrichtigungen bei neuen Bug-Reports:
  - Option A (E-Mail über Resend):
    - Secret: `RESEND_API_KEY`
    - Secret: `BUG_REPORT_NOTIFY_EMAIL_TO` (Empfänger)
    - Secret: `BUG_REPORT_NOTIFY_EMAIL_FROM` (Absender, z. B. `GA Dispatcher <bugs@deinedomain.tld>`)
    - Optional: `BUG_REPORT_NOTIFY_SUBJECT_PREFIX` (Default: `[GA Dispatcher]`)
  - Option B (Webhook, z. B. Zapier/Make/Discord/Slack):
    - Secret: `BUG_REPORT_NOTIFY_WEBHOOK_URL`
  - Beide Optionen können parallel aktiv sein.

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
6. Optional Benachrichtigungen setzen:
   - `npx wrangler secret put RESEND_API_KEY`
   - `npx wrangler secret put BUG_REPORT_NOTIFY_EMAIL_TO`
   - `npx wrangler secret put BUG_REPORT_NOTIFY_EMAIL_FROM`
   - `npx wrangler secret put BUG_REPORT_NOTIFY_WEBHOOK_URL`
   - Optional als normale Var in `wrangler.toml`:
     - `BUG_REPORT_NOTIFY_SUBJECT_PREFIX = "[GA Dispatcher]"`
7. Deployen und im Frontend testen:
   - `loadAipChartOverlay(ICAO, country)`
   - `startAipChartCalibration()`
   - `setAipChartOpacity(value)`
   - `clearAipChartOverlay()`
