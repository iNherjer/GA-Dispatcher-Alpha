# Desktop 1.6.18 – Autostart: Drag & Drop repariert

Basis: Desktop 1.6.17 (`origin/main`). Tracker-Runtime unverändert.

## Fehler in 1.6.17

Programme, die ins Autostart-Feld gezogen wurden, erschienen nicht in der Liste.
Ursache: Der Renderer übergab die `FileList` direkt an die Preload-Brücke. Über die
`contextBridge` kommt eine `FileList` nur als leeres Objekt an, daher wurden keine
Pfade ermittelt und es kam auch keine Fehlermeldung.

## Änderungen

- Der Renderer übergibt `Array.from(dataTransfer.files)`. Die Preload-Brücke nimmt nur
  Arrays an und ermittelt die Pfade mit `webUtils.getPathForFile`.
- Button „+ Importieren“ im Drag-Feld (Text links, Button rechts). Er öffnet die
  Windows-Dateiauswahl. Ein Drop wird überall im Feld angenommen, auch auf dem Button.
- Meldung, wenn ein Drop nichts übernimmt.

## Prüfung

- 89 Desktop-Tests bestanden, inklusive UI-Vertrag für die Array-Übergabe.
- In Electron (macOS) geprüft: Ein simulierter Drop kommt als Array mit Datei in der
  Preload-Brücke an.
- Offen: echter Drop aus dem Windows-Explorer.

## Fallback

Wie bei 1.6.17: Das Modul ist opt-in. Die Installer für 1.6.16 und 1.6.17 bleiben
unverändert auf GitHub.

## Aktivierung (19.10.2026)

Öffentlicher Download geprüft (100262310 Bytes, SHA-512 wie `latest.yml`, Blockmap identisch).
`latest.yml` und `alpha.yml` aktiviert. Windows-Feldtest steht noch aus.
