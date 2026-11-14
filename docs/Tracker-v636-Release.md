# Tracker v636 Alpha – Bodenbesetzung je Szene (Composer Etappe E)

Zusammen ausgeliefert mit Web v2399 (Cache). Keine Änderung an `tracker.js` außer der Version.

## Änderungen Tracker

- **Composer-Diagnose je Szene:** Die Zeile `GROUND_COMPOSER` zeigt zusätzlich
  `scenes=start:<Fahrzeug>(composer|capacity)/<Personen>;arrival:…` (Bringer und Empfänger mit
  Geschlecht/Look). Modul `tracker-ground-composer-log.js`. Nur Diagnose.
- **Privat-Rückflug spiegelt die Bodenbesetzung** (mitgepackter Kern `mission-private-return-core.js`):
  Vom Tracker gebaute Rückflug-Anträge tragen `groundCast` und `groundVisual.scenes` mit getauschtem
  Start/Ziel; wer am Ziel abgeholt hat, bringt beim Rückflug. Vor v636 stand die Besetzung dort
  seitenverkehrt (nur Optik).
- **Charter-Fortsetzung** (mitgepackter Kern `mission-charter-continuation-core.js`): `mirrorGround`,
  im Tracker ohne Wirkung (nur Gleichstand der Kopie).
- `EFB_WEB_ASSET_REVISION` 63601.

## Web (seit v2398, ohne Build)

- Empfänger am Ziel steigen nach dem Aussteigen mit ins Abholfahrzeug (`departWithPickupVehicle`,
  vorhandene Tracker-Logik `planPickupReception` seit v634).
- Die Mindestversion bleibt unverändert.

## Geprüft

- Tracker-Suite 1564/1566 (2 übersprungen, 0 Fehler), Web-Tests einzeln grün.
- **Im Simulator und im MSFS-EFB noch nicht geprüft.**

Stable bleibt unverändert.
