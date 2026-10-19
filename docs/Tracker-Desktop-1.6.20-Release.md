# Desktop 1.6.20 – Autostart: Launcher-Programme, Startargumente, Kontextmenü

Basis: Desktop 1.6.19 (`origin/main`). Tracker-Runtime unverändert.

## Fehler in 1.6.19

Programme, die über einen Launcher ihren eigentlichen Prozess starten (z. B.
`Update.exe` → `app-x\Programm.exe`), wurden beim Sim-Ende nicht geschlossen, weil
nur der Dateiname der gestarteten EXE bekannt war.

## Änderungen

- Vor dem Autostart wird die Prozessliste (`Win32_Process`) gemerkt; `Start-Process
  -PassThru` liefert die Prozess-ID jedes Programms.
- Beim Schließen gelten nur neue Prozesse als eigene, die von einem gestarteten
  Prozess abstammen (auch über einen beendeten Launcher) oder aus dessen Programmordner
  kommen. Allgemeine Ordner (Laufwerk, erste Ebene, Windows, Desktop, Downloads,
  Dokumente, OneDrive) zählen nur über die Abstammung. Sim und vorher laufende
  Prozesse bleiben offen. Ohne Prozessliste Rückfall auf den Dateinamen.
- Startargumente pro Programm und für den Steam-Sim (`steam://run/<id>//<args>/`).
  Der Store-Start nimmt keine Argumente an.
- „Als Admin starten“ und Startargumente liegen in einem Kontextmenü hinter einem
  ⋯-Kreis rechts am Eintrag; Schließen per Klick außerhalb oder Escape.

## Prüfung

- 94 Desktop-Tests bestanden, inklusive Launcher-Kindprozess, Ordnerabgleich,
  Argumenten und Steam-URL.
- Kontextmenü im Browser mit dem echten UI geprüft (Öffnen, Position, Schließen).
- Offen: Windows-Feldtest mit echtem Launcher und Steam-Argumenten.

## Aktivierung (19.10.2026)

Öffentlicher Download geprüft (100264808 Bytes, SHA-512 wie `latest.yml`, Blockmap identisch).
`latest.yml` und `alpha.yml` aktiviert. Windows-Feldtest steht noch aus.
