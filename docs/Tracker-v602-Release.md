# Tracker v602 Alpha / Web v2286 – E6B baut einmal auf, Buttons springen nicht mehr

## Änderungen

- EFB (Tracker-Kopie des E6B): Jede Scheibe wird nur noch einmal aufgebaut. Das Workbench-JSON wird zuerst geladen;
  gespeicherter, vorgeladener und eingebauter Stand sind nur Rückfälle. Bisher wurde die Vorderseite erst leer bzw. als
  Ersatz und danach ein zweites Mal gezeichnet (doppelte Coherent-SVG-Aufbereitung).
- EFB: `ga-e6b-view-state` trägt additiv `discReady`. Der Host blendet seine Buttons erst ein, wenn die sichtbare Seite
  fertig ist; vorher sprangen sie von der Ersatzposition oben rechts in die vier Ecken. Der Hinweis
  „Workbench-Stand speichern“ blinkt beim Laden nicht mehr auf. Sicherheitsnetz nach 5 Sekunden.
- Web (mit diesem Push live): derselbe Einmal-Aufbau im Kartentisch, Vorladen beim Zeigen/Antippen des E6B-Buttons,
  Bewegungs-CSS-Variablen ohne Vererbung (Verschieben ~2,7 → 0,02 ms pro Schritt), Pinch-Zoom am Smartphone um die
  Fingermitte, zweiter Finger darf neben der Scheibe liegen.
- `EFB_WEB_ASSET_REVISION` 60201.

Nur Alpha-Runtime umstellen, Stable unverändert.

## Prüfung

- `ga-tracker-client/tracker-efb-web-client.test.js`, `tracker-efb-http-server.test.js`, `tools/e6b-core.test.js`.
- Browser: EFB-Frame mit `coherent=1` meldet zuerst `discReady: false` mit Ersatzpositionen, dann `true` mit
  Endpositionen; Vorderseite einmal gerendert.

## Im Feld prüfen

- EFB im Sim: E6B öffnen – Buttons erscheinen einmal an den Ecken, kein Springen, kein grauer Hinweis.
- Umdrehen auf die Windseite, Zoom, Schließen funktionieren.
