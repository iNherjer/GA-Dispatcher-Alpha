# GAFOR Sektor Topologie Editor (extern)

Datei: `tools/gafor-sector-editor.html`

## Ziel

- Externes Tool (nicht in der App-UI).
- Topologie-basiertes Editieren: gemeinsame Grenzen bleiben verbunden.
- Ergebnis als JSON exportierbar und damit direkt commit/pushbar.

## Kurzablauf

1. Tool oeffnen: `tools/gafor-sector-editor.html`
2. `Default-Polygone aus App laden`
3. Sektor waehlen
4. Bearbeiten:
   - Knoten ziehen: verschiebt verbundene Nachbargrenzen mit
   - `Insert auf Grenze`: Klick auf Segment fuegt Knoten auf gemeinsamer Kante ein
   - `Neu zeichnen`: aktiven Sektor neu definieren
5. `Export Datenbasis`:
   - Vollstaendiger Stand aller Sektoren als JSON (empfohlen als repo-baseline)
6. `Export Overrides`:
   - Nur Abweichungen gegen den geladenen Default-Stand
7. Optional `In App speichern`:
   - Schreibt in LocalStorage (`ga_gafor_sector_poly_overrides_v1`) fuer direkte Vorschau in der App

## Empfohlene Repo-Nutzung

- Exportierte Datenbasis als Datei im Repo ablegen, z. B.:
  - `tools/data/gafor-sector-dataset-de.json`
- Diese Datei versionieren und als gemeinsame Quelle fuer Reviews/PRs nutzen.

