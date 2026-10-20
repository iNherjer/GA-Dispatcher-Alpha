# Desktop 1.6.28 – Tracker im Autostart, Debug-Schalter entfernt

Basis: Desktop 1.6.27 (`origin/main`). Tracker-Runtime unverändert.

## Änderungen

- Schalter „Tracker-Missionslogik deaktivieren (nur Debug)“ entfernt. Missionen
  laufen außerhalb des Sim-Modus nur noch unter Tracker-Authority; ein früher
  gespeichertes Debug-Opt-out wird ignoriert, der Tracker startet immer mit
  aktiver Missionslogik. Der harte Missionsreset ist bei laufendem Tracker verfügbar.
- Autostart: Der Tracker ist ein fester Listeneintrag. Position und Wartezeit
  sind frei wählbar, er kann nicht entfernt werden und bleibt immer in der
  Startliste vor SimConnect (EFB in der Weltkarte). Ältere Einstellungen
  erhalten ihn an erster Stelle (bisheriges Verhalten „erst Tracker“).
- Optional „Mit dem Sim beenden“: Ein vom Autostart gestarteter Tracker wird
  beendet, sobald der beobachtete Sim geschlossen wurde. Ein vorher bereits
  laufender Tracker bleibt; beim Beenden der App stoppt die App ihn wie bisher.

## Prüfung

- 120 Desktop-Tests bestanden (inkl. neuer Autostart-Tests für Position,
  Wartezeit, Startliste, Beenden mit dem Sim und fehlgeschlagenen Start).
- Windows-Installer auf macOS gebaut; Windows-Feldtest offen.

## Aktivierung (20.10.2026)

Öffentlicher Download geprüft (100281327 Bytes, SHA-512 wie `latest.yml`, Blockmap identisch).
`latest.yml` und `alpha.yml` aktiviert.
