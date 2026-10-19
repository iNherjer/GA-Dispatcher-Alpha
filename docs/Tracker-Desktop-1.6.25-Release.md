# Desktop 1.6.25 – Restlautstärke konsistent, 1-s-Fortsetzen

Basis: Desktop 1.6.24 (`origin/main`). Tracker-Runtime unverändert.

## Feldtest 1.6.24 (19.10.2026)

Video des Testers: Im EFB/Web gewählte Restlautstärke (35 %, 50 %, 10 %) sprang nach
etwa einer Sekunde auf 20 % zurück. Ursache: Das Desktop-Fenster hielt eine eigene
lokale Kopie (`localStorage`) und setzte sie bei jedem Abgleich (1 s) erneut, sobald
der Medien-Helfer einen anderen Wert meldete.

## Änderungen

- Die Restlautstärke und „Bei Ansagen leiser“ gehören jetzt der App: alle Clients
  fordern nur noch an, die App speichert dauerhaft (`mediaDuck`) und setzt den Wert
  beim Neustart des Helfers erneut. Das Desktop-Fenster zeigt nur noch an.
- Eine bisher im Desktop-Fenster gespeicherte Einstellung wird einmalig übernommen.
- Funk-Pause: „Automatisch weiter nach“ bietet zusätzlich 1 s.

## Prüfung

- 120 Desktop-Tests (117 bestanden, 3 Windows-only übersprungen), neu: Speicherung
  und Wiederherstellung der Restlautstärke, 1-s-Fortsetzen.
