# Tracker v640 Alpha – EFB-Kartenmenü: Esri Topo, regionale Basiskarten, Abblendstufen

Zusammen ausgeliefert mit Web v2434 (nur Cache).

## Anlass

Seit 15.11.2026 blendet OpenTopoMap (Betreiber Top-O-Map, Gratisstufe) im Ingame-EFB auf
manchen Kacheln ein Werbebanner ein („You like this map, pilot? … top-o-map.com/fly“). Die
Web-App hat seit v2431/v2432 zusätzliche Basiskarten ohne Schlüssel; das EFB übernimmt davon,
was Coherent-tauglich ist.

## Änderungen EFB/Tracker

- `efb-app/map-shell-core.js`: globale Basiskarte „Esri Topo (Welt)“; neue
  `REGIONAL_BASE_LAYERS` basemap.de (Priorität 20) und swisstopo (Priorität 10) mit
  Kachelgrenzen; Einstellungen `regionalBases` (Aktivierungsreihenfolge) und
  `baseDimPercent` (0–90, Standard 50); `baseLayerOpacity` = 1 − baseDimPercent/100 bei
  aktivem Aero-Overlay.
- `tracker-efb-kartentisch-host.js`: regionale Karten in `gaBasePane` über der globalen Karte,
  unter allen Overlays; basemap.de liegt immer über swisstopo, gleiche Priorität nach
  Aktivierung. Nach dem Anlegen von `L.control.layers` (eigene Auto-zIndex-Werte) wird neu
  gestapelt. Abblenden als Opacity auf `gaBasePane` statt je Kachel-Layer, Stärke per −/+ in
  10er-Stufen im Kartenmenü (kein Range-Regler). Menü mit Gruppenüberschriften.
- `tracker-efb-tile-proxy.js`: Quellen `esri-topo`, `basemap-de`, `swisstopo` als letzte
  Ausweichstufe.
- EFB-Web-Assets: `styles.css` (Gruppenüberschriften per Klasse `ga-layer-groups` statt
  `:has()`, Stufenknöpfe) und `i18n/en-phrases.js`.
- OSM/CyclOSM bewusst nicht im EFB (OSM-Kachelregeln verlangen Referrer bzw. App-Kennung).
- Standardkarte bleibt OpenTopo.
- `EFB_WEB_ASSET_REVISION` 64001.

Mitgeliefert aus der Release-Queue: „EFB-Kopien fuer das Web-Kartenmenue“ und
„EFB-Kopie profile.js: Diagnosezeile APT Platzdaten“.

## Tests

- Tracker-Suite `node --test *.test.js`: 1575/1577 bestanden, 2 übersprungen, 0 Fehler.
- Neue Fälle in `efb-app/map-shell-core.test.js` (regionale Karten, Abblendstufen).
- EFB-Seite lokal im Browser: Menügruppen, Stapelung nach Neuladen, Speichern der
  Einstellungen, −/+ ändert die Ebenen-Opacity.

## Im Feld prüfen (MSFS/Coherent, noch nicht geprüft)

- Basiskarte bei VFR-Overlay abgeblendet und nicht schwarz (neu: Opacity auf der Ebene).
  Rückfall bei Problemen: Opacity wieder je Basiskarten-Layer.
- basemap.de und swisstopo laden direkt; Grenze DE/CH bei Schaffhausen.
- −/+ in VR bedienbar; Menü scrollt bis zum Abblend-Block.

## Artefakt

- Release `v640`, Asset `VFR-Multitool-Tracker.exe`
- Größe: _wird nach Build eingetragen_
- SHA-256: _wird nach Build eingetragen_
