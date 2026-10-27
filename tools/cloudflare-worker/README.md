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

## METAR-Abfragen und Kompatibilität (14.09.2026)

`GET /api/metar` akzeptiert `ids`, `bbox` oder eine URL in `src` auf
`https://aviationweather.gov/api/data/metar`. Der Proxy erzwingt JSON und entfernt
aus `src` den früher von der App angehängten Cache-Buster `t`. AviationWeather
weist diesen unbekannten Parameter mit HTTP 400 / `Unexpected query parameter
provided` zurück. Die sieben URL-Erzeuger in `app.js`, `airport-weather.js`,
`profile.js` und `checklists.js` senden ihn ebenfalls nicht mehr. Die Bereinigung
im Worker unterstützt noch geladene ältere Clients, sobald der Worker deployed ist.

Eine leere Stationsantwort mit HTTP 204 wird ohne Response-Body weitergegeben,
damit der Client seine Gebietssuche fortsetzen kann. Erfolgreiche Antworten
behalten `Cache-Control: public, max-age=30`; Upstream-Fehler erhalten `no-store`.
Die Freigabe der Quellhosts und gültige Abfrageparameter bleiben erhalten.

`metar-proxy.test.mjs` ist Teil von `npm test`. Der separate Live-Nachweis
`node tools/mission-weather-live-probe.mjs` (vom Repository-Root) verwendet den
lokalen Worker-Handler und echte öffentliche AviationWeather-Daten. Er prüft
keinen bereits veröffentlichten Worker und benötigt keine Schlüssel.

Der Fehler- und Ablaufzeit-Test des Missions-Caches liegt in
`tools/mission-weather.test.cjs`. Die vollständige Reparatur benötigt sowohl das
App-Update als auch das Worker-Deployment. Ein Worker-Update allein leert keinen
bereits vorhandenen, alten Null-Snapshot im Browser-Arbeitsspeicher.

## OpenAIP-Regionscache und Rollback

Der Snapshot-Endpunkt lädt Flugplätze einschließlich Platztyp, PPR-/Privatstatus,
Services und Pisten, Lufträume, Navaids einschließlich Frequenz/Kanal/Reichweite
und Reporting Points für dieselbe BBox gebündelt. Die BBox darf entsprechend der
OpenAIP-Regel höchstens 5° breit und 5° hoch sein.

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
- Ein Profil-Upload an `/api/sync/*` darf hoechstens 256 KiB gross sein. Der
  Browser verwendet dieselbe Grenze; seine stufenweise Kompaktierung versucht
  Mission, Pinnwand, Logbuch und Follow-ups vorher unter diesen Wert zu bringen.
- Die groessere Obergrenze veraendert weder Request- noch KV-Write-Anzahl. Ein
  Profilsave bleibt genau ein bestehender Sync-Request und ein KV-Schreibvorgang;
  damit bleiben die Free-Kontingente nach Vorgangsanzahl unveraendert.
- Die Checklist-Community nutzt vorhandene Sync-Profile zur PIN-Prüfung. Veröffentlichte Records speichern `ownerId`, Titel, Kapitel/Punkte, Zähler und Version, aber niemals den PIN.
- `POST /api/checklists/community` erwartet `{ "action": "publish", "checklist": { ... } }` oder `{ "action": "unpublish", "id": "..." }`.
- Für den Bugtracker kann optional ein Secret gesetzt werden:
  - `BUG_TRACKER_ADMIN_TOKEN` (als Worker Secret, nicht als plain var)
  - Wenn kein Secret gesetzt ist, sind List/Detail/Ack-Endpoints offen.
- Der Nutzer-Admin und der Bugreport-Purge nutzen denselben Admin-Token. Der Nutzer-Endpunkt liefert nur kompakte Metadaten (`id`, `name`, `registeredAt`, `lastModified`) und nie PINs, Pinnwand, Logbuch oder Missionsdaten.
- Neue Sync-Profile bekommen serverseitig `registeredAt`; alte Profile ohne dieses Feld können kein verlässliches Registrierungsdatum liefern. In der Admin-Ansicht wird dann `unbekannt` angezeigt.
- Pilot-IDs werden bei Anmeldung und Sync unabhängig von Groß-/Kleinschreibung aufgelöst. Der Auth-Endpunkt erwartet `{ "pilotId": "...", "pin": "..." }` und liefert bei Erfolg ausschließlich die kanonische `pilotId`; Profildaten und PIN werden nie zurückgegeben. Neue Pilot-IDs werden in einer einheitlichen Großschreibung gespeichert.
- Homebase-Pläne liegen getrennt unter `homebase:<pilotId>`, werden über das bestehende Pilot-Profil authentifiziert und enthalten niemals den PIN. Der Endpunkt akzeptiert höchstens 64 KiB. Schema 2 speichert Hangar, bis zu 100 Ausstattungsobjekte sowie bis zu drei Personen mit jeweils höchstens 20 Routenzielen einschließlich Zufallszielmodus und Wartezeiten atomar in demselben Plan. Bei einer veralteten `baseRevision` antwortet der Endpunkt mit HTTP 409 und dem aktuellen Cloud-Stand; `people: []` ist ab Schema 2 eine verbindliche Löschung.
- Die Crew-Ansicht prüft die anfragende Pilot-ID samt PIN sowie die aktive Mitgliedschaft im `GROUP_`-Datensatz. Der Gruppen-Endpunkt liefert die opt-in-Pläne anderer aktiver Mitglieder (`crewShareEnabled`, pro Base höchstens Hangar plus 100 Ausstattungsobjekte und drei Personen) und ein Crew-Verzeichnis. Der Browser entfernt nicht live-spawnfähige Paketobjekte vor dem Aufbau, stellt Mitarbeitende statisch dar und begrenzt die gemeinsame Szene mehrerer naher Homebases auf 100 SimObjects. Nur bei aktivierter Freigabe enthält der Verzeichniseintrag die Homebase-Startkoordinate; das Verzeichnis enthält weder PINs noch Ausstattungsobjekte.
- Normale Crew-Mitglieder bleiben 90 Tage aktiv, Admins 365 Tage. Maßgeblich ist die letzte authentifizierte Nutzung der App, nicht die letzte Änderung am Crew Board. Der Login aktualisiert `lastAppSeen` serverseitig höchstens einmal pro UTC-Kalendertag; normale App- und Crew-Interaktionen erzeugen keinen zusätzlichen Aktivitäts-Write. Ein ohnehin stattfindender Profil-Save nimmt den aktuellen Tagesstempel ohne Extra-Request mit.
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

## Profil-Sync V2 (2026-09-16)

`worker-merged-full.js` exportiert `ProfileSync` aus `profile-sync.mjs`.
`wrangler.toml` legt mit Migration `profile-sync-v1` einen SQLite Durable Object
unter Binding `GA_PROFILE_SYNC` an; bestehendes `GA_SYNC_KV` bleibt erhalten.
Details zu Endpunkten, Grenzen, Quoten und kompatiblem Rollout:
[Cloud Profile Sync V2](../../docs/Cloud%20Profile%20Sync%20V2.md).
`npm test` enthaelt die Verlustfrei-/Konflikt-/Abbruchtests.

## Profil-Sync V2: weniger Schreibzugriffe (Tracker v414)

`GET /api/sync-v2/head?inlineMetadata=1` liefert Faehigkeiten fuer Inline-
Zeitstempel und `POST /api/sync-v2/chunks`. Alte Head-Leser erhalten weiterhin
normal abrufbare Hash-Pakete; ihre Metadaten werden bei Bedarf materialisiert.
Neue Leser schreiben nichts. Batches maximal 127 Teile (plus Zaehler = 128
Storage-Keys), Request-Body weiterhin maximal 96 KiB. Missing-Lookups werden
in Gruppen von 128 gelesen. GC schreibt unveraenderte Zaehler nicht erneut.

Worker vor Web/Tracker ausrollen. Beim Worker-Rollback Inline-Unterstuetzung
beibehalten. Protokoll, Messwerte und Grenzen: `docs/Cloud Profile Sync V2.md`
im Repository-Root. Messung: `node tools/cloud-sync-quota-audit.mjs`.


## FAA-Platzkontext (Bush-Pilot 07.10.2026, lokal)

`GET /api/airport-context/faa?ident=U60` liefert normalisierte Daten aus FAA
Airport Display. Fester Upstream-Host, Kennung 2–5 alphanumerische Zeichen,
2500 ms Timeout inklusive Antwortkörper, maximal 256000 Bytes. Kennung,
Koordinaten und gültiger FAA-Datenzyklus müssen vorhanden sein. Versteckte
Baustellen-Platzhalter und Skripte werden nicht als Hinweise übernommen;
Runway-Ende und zugehörige Angaben bleiben getrennt. Fehler bleiben `no-store`;
Erfolgsantworten sind öffentlich cachebar, Cache-Hits prüfen den Datenzyklus.
Cloudflare Cache-Schreiben wird über `ctx.waitUntil` gehalten. Kein allgemeiner
URL-Proxy und keine KV-/Nutzerdaten.

`airport-context-faa.test.mjs` ist Teil von `npm test`. Der öffentliche Live-Test
`node tools/airport-information-live-probe.mjs` nutzt den lokalen neuen Handler,
nicht den veröffentlichten Worker. App und Worker müssen gemeinsam ausgerollt
werden. Ohne neuen Endpoint fällt nur die optionale FAA-Ergänzung aus.


### Missionskontrolle v1 (08.10.2026, deployed)
Sync-V2-Head bietet `capabilities.missionControl=true`. Commit mit `missionChange` (`action`, `expectedMissionRevision`, `operationId`) aktiviert/löscht den gemeinsamen Missionsslot mit unabhängiger Serverrevision. Der Head bindet den Vermerk an den Missionshash. Profiländerungen behalten die Missionsrevision; alte Clients können den kontrollierten Slot nicht ohne Aktivierungs-/Löschvermerk wechseln, auch nicht über `force`. Commit-Fingerprint enthält den Vermerk für idempotente Wiederholung nach verlorener Antwort. Worker vor App/Tracker v500 deployen; App verweigert destruktive Übernahme, solange die Fähigkeit fehlt. Siehe Cloud Profile Sync V2.

## Administrative Pilot-ID-Umbenennung (26.10.2026)

Stand dieser Änderung: am 26.10.2026 nach ausdrücklicher Nutzerfreigabe
produktiv deployed. Worker-Version: `bae753ab-ed12-4854-b161-e79f5d6889de`.
Das lokale Admin-Tool prüft die Cloud-Fähigkeit weiterhin vor jeder Vorschau
und Ausführung. Durch das Deployment allein wird kein Konto umbenannt.

`GET /api/admin/capabilities` kündigt mit `accountRename: 1` die Unterstützung
für das lokale User-Admin-Tool an. Der Cloud-Worker bietet keinen öffentlichen
Umbenennungs-Schreibendpunkt. Die Wartungsaktion läuft über den vorhandenen,
lokal authentifizierten Wrangler-Zugang; Details in `../user-admin/README.md`.

Umbenannte Auth-Records enthalten einen adminverwalteten `accountStorageId`
(ursprüngliche Speicherkennung), `accountUid` (Kontogeneration) und
`accountPreviousIds`. Frühere IDs werden zu permanenten Records mit Schema
`ga.account-retired.v1`, `renamedTo` und derselben `accountUid`, ohne PIN.
Die Anmeldung und Registrierung unter einer früheren ID liefern HTTP 409
`pilot_id_renamed`; `accountStatus: renaming` liefert `account_maintenance`.

Nur interne, bereits verknüpfte Crew-/Checklist-Referenzen folgen solchen
Vermerken, mit Prüfung der Kontogeneration. Die eigentliche Authentifizierung
folgt keinem alten Login-Namen. Der ursprüngliche Sperrvermerk muss zusätzlich
die aktuelle ID und Generation bestätigen, bevor ein Auth-Record einen
abweichenden Speicheranker verwenden darf. V2, Legacy-V2-Lesen, Homebase und
Audio nutzen diesen verifizierten Anker; weder Cloudpakete noch Missionskontrolle
werden kopiert oder neu geschrieben. Crew-Ausgaben verwenden die aktuelle ID,
erhalten Rollen und versehen umbenannte Mitglieder mit der Kontogeneration.
Crew-Saves normalisieren diese Verweise im vorhandenen Schreibzugriff.
Community-Checklisten behalten ihren stabilen Eigentümeranker.

Öffentliche Registrierungen können diese Metadaten nicht setzen; bestehende
Legacy-Saves müssen die serverseitigen Werte erhalten. Ein Rollback auf einen
Worker ohne diese Unterstützung ist nach der ersten tatsächlichen Umbenennung
nicht zulässig, solange solche Konten bestehen. Die neue lokale Admin-Funktion
wird erst nach dem Worker-Deployment nutzbar. Kein Tracker-/Web-App-Release
notwendig; die Nutzer melden sich anschließend mit der neuen ID an.

`account-rename.test.mjs` ist Teil von `npm test` und prüft den echten
Worker-/ProfileSync-/Client-Pfad: alte und neue Registrierungsnamensräume,
mehrfache Umbenennung, unveränderte Mission/Revision/Pakete, Homebase, Audio,
Crew-Rollen, Checklist-Eigentum, veraltete IDs, gefälschte Speicheranker und
spätere Neuregistrierungen. Die lokalen Admin-Tests prüfen Vorschauen, Konflikte,
Sicherungen und Rücksetzung nach jedem einzelnen Schreibschritt.

## Flugbuch-Speicher v1 (27.10.2026, noch nicht deployed)

`/api/flightlog-v1/` (`flight-logbook.mjs`, Durable Object `FlightLogbook`, Migration
`flight-logbook-v1`). Getrennt von Sync-V2, damit ein neuer Flug nur wenige KB kostet.
Anmeldung wie Sync-V2 (`X-Pilot-ID`/`X-Pilot-PIN`); Objekt je Pilot über den verifizierten
Speicheranker (`storageOwnerId`, folgt Umbenennungen) plus Registrierungsnamensraum
(neu angelegte gleiche ID erbt keine alten Flüge).

- `GET list[?since=<revision>]` – Einträge ohne Spur, neueste zuerst; unverändert → `{unchanged:true}`
- `GET track/<runId>` – eine Spur (`flight-track-codec-core.js`, 1–3 KB)
- `POST put {entry, track}` – Eintrag ≤ 4 KB, Spur ≤ 32 KB und dekodierbar; je Art (`free`, `mission`) bleiben die neuesten 50
- `POST delete {runIds}` oder `{kind}`

Schreiber: Tracker (`tracker-flight-logbook-cloud.js`). Leser: Web-App-Flugbuch.
Konzept: `docs/Flugbuch Kruemelweg Konzept.md`. Deploy vor Tracker-Release; ohne Deploy
antwortet der alte Worker 404 und der Tracker versucht es mit Backoff später erneut.
