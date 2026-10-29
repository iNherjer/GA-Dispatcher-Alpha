# Tracker v604 Alpha / Web v2291 – Route Reset auf die Dispatch-Route

## Änderungen

- Tracker (`tracker-cockpit-tools.js`): Freiflug-Reset springt auf die Dispatch-Route. `navigation_adopt` übernimmt die
  von der App mitgeschickten `resetPoints`; erneutes Laden desselben Plans aus der Cloud (gleiche `planId`) behält sie.
  Bisher galt die gerade übernommene, oft schon bearbeitete Route als Ausgangsroute.
- Web und Tracker (`freeflight-navigation-core.js`): `freeflightNavigation` führt die Dispatch-Route optional als
  `resetPoints`, damit sie auch andere Geräte erreicht.
- Web (seit v2289 live): Route Reset mit Rückfrage, Dispatch-Route im Missionsstand; Kartentisch-Kopf als
  Symbol-Kacheln auf Handys (EFB ausgenommen, EFB-Kopien von `styles.css` und `map-profile-controls.js` nachgezogen).
- Aus der Warteschlange: Debug-Log schlüsselt `ga_active_mission` auf (EFB-Kopie `profile.js`).
- `EFB_WEB_ASSET_REVISION` 60401.

Volle Tracker-Testsuite: 1525 Tests, 0 Fehler.

Nur Alpha-Runtime umstellen, Stable unverändert.

## Im Feld prüfen

- Freiflug planen, Tracker verbunden: Wegpunkte setzen (App oder EFB), App in den Hintergrund und zurück, Route Reset →
  Rückfrage, danach genau die Dispatch-Route in App und EFB.
- Ohne Tracker: Route Reset entfernt eigene Wegpunkte nach Rückfrage; nach App-Neustart gleiches Ergebnis.
