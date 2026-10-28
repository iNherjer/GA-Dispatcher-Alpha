# Tracker v599 Alpha / Web v2256 – Cloud-Checklisten nur noch auf Abruf

## Änderungen

- Tracker: Die eigenen Cloud-Checklisten (`CHKIDX_`/`CHK_`) werden nicht mehr alle 60 Sekunden abgefragt,
  sondern nur beim Start, beim Öffnen der Checklistenliste in der EFB (höchstens alle 2 Minuten) und über den
  neuen Knopf ↻ in der Liste (Cockpit-Tool `refresh_checklists`, höchstens alle 15 s). Ist die Web-App
  verbunden, liefert sie die Checklisten weiter direkt; der Knopf meldet das.
- Grund: Ohne Checklisten endete jede Minuten-Abfrage mit 404 und kostete im Worker einen KV-List-Vorgang
  (Cloudflare-Mail „50 % des KV-Tageslimits“ am 28.10.2026). Der Worker ist seit Version
  `e2beced8-98c3-43dd-9a65-013df724e70c` bereits entschärft (Checklisten-Schlüssel nur exakt lesen); v599
  spart zusätzlich die Anfragen selbst.
- EFB-Assets neu synchronisiert (`checklists.js` mit dem Knopf, `styles.css` aus den Web-Ständen bis v2255).

Web: `checklists.js` zeigt den Knopf nur in der EFB (`gaChecklistHost.refreshChecklists`), in der Web-App
ändert sich nichts.

Nur Alpha-Runtime umstellen, Stable unverändert.

## Prüfung

- `tracker-efb-http-server`, `tracker-cockpit-control-core`, `tracker-cockpit-tools`,
  `tracker-efb-checklist-cloud`, `tracker-efb-checklist-library`: 57 Tests; EFB-Asset-/Web-Client-Tests 44.
- Worker: `npm test` in `tools/cloudflare-worker` grün (neuer Fall: fehlende Checklisten-Schlüssel lösen keine
  KV-Liste aus).

## Im Feld prüfen

- Tracker ohne Web-App starten, EFB-Checklistenliste öffnen: eigene Cloud-Checklisten erscheinen.
- Am PC eine Checkliste anlegen, in der EFB ↻ drücken: sie erscheint, Statuszeile „Checklisten aktualisiert.“
- Mit verbundener Web-App ↻ drücken: Hinweis, dass die Checklisten aus der App kommen.
