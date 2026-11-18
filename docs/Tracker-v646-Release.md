# Tracker v646 Alpha – Vorläufige Rückblick-Aufträge sofort aufräumen

Zusammen ausgeliefert mit Web v2445 (18.11.2026; enthält Web v2443/v2444).

## Änderungen

- `mission-authority-core.js`: Ein beim Aufsetzen angelegter vorläufiger Rückblick-Auftrag wird
  bei Abschluss ohne Angebot und bei Abbruch sofort aus `followupRecapQueue` entfernt (bisher
  bis zu 2 Tage in der laufend geschriebenen Zustandsdatei).
- Web v2443: Ältere Rückblicke ohne `offerText` zeigen ihren Rückkehrgrund (ganze Sätze, max.
  350 Zeichen); App wartet 10 min nach der Landung auf den Tracker; Debug-Bericht zeigt pro
  Rückflug den Rückblick-Stand.
- Web v2444: App-Rückfall arbeitet fällige Rückflüge nacheinander ab, auch bei eingeklapptem
  Bereich; Fehler wird an der Anfrage vermerkt (`recapError`); Versuch ohne Ausgang darf nach
  10 min einmal wiederholt werden.
- `EFB_WEB_ASSET_REVISION` 64601.

## Tests

- Alle Tracker-Testdateien einzeln (siehe Übergabe); neu: Aufräumen bei Abschluss ohne Angebot
  und Abbruch; App-Warteschlange mit zwei Rückflügen.
- MSFS noch nicht geprüft.

## Feldtest

- Mission nach dem Aufsetzen abbrechen: danach kein `MISSION_FOLLOWUP_RECAP_WRITTEN`.
- Zwei offene Rückflüge ohne Rückblick: beide bekommen nach dem App-Start nacheinander Text.

## Artefakt
