# Tracker v621 Alpha / Web v2353–v2354 – Schatten auf iPhone, frische Updates

## Änderungen

- **Eigenes Flugzeug: Rand und Schatten auf der gedrehten Grafik** (`ownPlaneSvgFilter` in
  `map-live-presentation.js`). Vorher lagen beide als Filter auf dem Rahmen um die rotierende,
  separat zusammengesetzte Grafik (`will-change: transform`); iOS Safari zeichnet das nicht
  (User-Screenshot 06.11.2026: kein Rand, kein Schatten). Jetzt Schatten aus der reinen
  Silhouette, Versatz gegen den Kurs zurückgedreht (bleibt Südost), danach der 5-px-Rand.
  Web `sync.js` `_applyOwnPlaneSvg`, EFB `rotatePlane`/`applyOwnPlaneFilter`. Low-FPS schaltet
  beides ab.
- **Web v2353 (bereits live): Service Worker lädt beim Update frisch** (`?sw=<Version>`,
  `cache: 'reload'`), damit nach einem Push keine alten Dateien in der neuen Version hängen.
- `EFB_WEB_ASSET_REVISION` 62101.

## Geprüft

- Safari-Engine (WebKit, iPhone-14-Profil) und Chrome: Schatten als Silhouette nach Südost bei
  Kurs 0°, 90°, 225°; Icon-Wechsel, Regler, Schalter. Echtes iPhone-Safari: Test durch User.
- Tests: Web 214/214, EFB 147/147, Tracker 1544/1546 (2 übersprungen, 0 Fehler).

Stable bleibt unverändert (v605).

## Aktivierung

_wird nach Build und Download-Prüfung ergänzt_
