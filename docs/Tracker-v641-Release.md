# Tracker v641 Alpha – Missionsstart beim Losrollen

Zusammen ausgeliefert mit Web v2435 (Banner im gemeinsamen UI-Kern).

## Anlass

Tester vergaßen nach Unterschrift und „Verladung bestätigen“ den zweiten Startknopf
(„Mission starten“, Phase `boarded`). Sobald sie losrollten, verschwand der Knopf, weil die
Startfreigabe 3 s Stillstand verlangt.

## Änderungen

- `tracker-mission-start-readiness.js`: neues `createTaxiAutoStart`. Zählt in Phase `boarded`
  Readiness-Pakete, in denen die Freigabe nur wegen Bewegung fehlt und GS mindestens 1 kt
  beträgt. Nach 3 s Rollen am Stück ist der Start fällig, danach 3 s Hinweis.
- `tracker-mission-execution-runtime.js`: löst den Start selbst aus (`taxi-autostart:<run>:<zeit>`,
  Rolle `tracker`) und übergeht dabei nur für diesen internen Aufruf die Stillstandprüfung.
  Status in `startReadiness.taxiAutoStart`. Log `MISSION_TAXI_AUTOSTART`.
- `tracker-mission-execution-adapter.js`: Bush-Grenze 2 kt gilt nicht für diesen internen Start.
- `mission-apt-ui-core.js` (EFB und Web): Banner „Taxi gestartet, Mission beginnt automatisch in“,
  Knopf „3 Sek.“ → „1 Sek.“, danach „Mission gestartet. Guten Flug!“.
- Vertrag: `docs/Mission Runtime Authority Contract.md`, Abschnitt 17.11.2026.
- `EFB_WEB_ASSET_REVISION` 64101.

## Tests

- Tracker-Suite `node --test *.test.js`: 1579/1581 bestanden, 2 übersprungen, 0 Fehler (ein vorheriger Lauf unter Last mit Timing-Fehlern in SAR-/Feuer-/Audio-Integration, einzeln grün; sauberer `origin/main` zeigt dasselbe Flackern).
- Neu: Rollerkennung (3-2-1, Abbruch, Fehlstart), Laufzeit Ende-zu-Ende von Verladung bis
  `active`, Banner in APT- und POI-UI-Kern.
- Im MSFS noch nicht geprüft.

## Feldtest

Nach „Verladung bestätigen“ losrollen: Countdown 3-2-1 im EFB und im Web, Mission startet,
3 s Hinweis. Kurz anrollen und wieder stehen: Countdown verschwindet, normaler Knopf zurück.
Bush-Mission ebenso.

## Artefakt

- Tag `v641`, Asset `VFR-Multitool-Tracker.exe`
- Größe: offen
- SHA-256: offen
