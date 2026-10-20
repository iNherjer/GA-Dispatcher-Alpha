# Desktop 1.6.27 – Auswahlfelder springen nicht mehr zurück

Basis: Desktop 1.6.26 (`origin/main`). Tracker-Runtime unverändert.

## Feldtest 1.6.25 (19.10.2026)

`funk-pause-log.txt` des Testers: `music=dim/35%` gespeichert, 1,6 s später ohne
neue Auswahl `music=dim/20%`. Ursache: Während die Speicherung lief, zeichnete das
Fenster das Auswahlfeld mit dem alten Wert neu; Chromium meldete das als neue Wahl
und speicherte den alten Wert zurück.

## Änderungen

- Funk-Pause und „Bei Ansagen leiser“: Auswahl wird sofort übernommen; ein Feld,
  das gerade bedient wird, wird nicht mehr überschrieben.
- Log: `CHANGE {…}` für jede Änderung der Funk-Pause, `MEDIA duck … from=<Client>`
  für jede Änderung der Ansagen-Absenkung mit Herkunft (Desktop, Web, EFB).

## Offen

- Web-/EFB-Einstellungsfeld aktualisiert die Restlautstärke nur bei geöffnetem
  Player (Tracker-/EFB-Release nötig).

## Prüfung

- 120 Desktop-Tests (117 bestanden, 3 Windows-only übersprungen).
