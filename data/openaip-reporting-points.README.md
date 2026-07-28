# OpenAIP Reporting-Point-Fallback

`openaip-reporting-points.json` ist ein kompakter, statischer Fallback fuer
OpenAIP-VFR-Meldepunkte. Die App laedt die Datei erst beim Oeffnen des
Kartentischs und speichert sie nicht im `localStorage`.

Die Live-Daten aus dem regionalen OpenAIP-Snapshot bleiben vorrangig. Die
statische Datei wird nur verwendet, wenn die `reportingPoints`-Sammlung des
Snapshots fehlt. Dadurch bleiben VRP-Snapping und Namen auch bei einem
temporären OpenAIP-/Worker-Limit verfügbar.

Neu bauen und pruefen:

```bash
node tools/build-openaip-reporting-points.mjs
node tools/openaip-reporting-points-selftest.mjs
```

Quelle: OpenAIP, Lizenz: CC BY-NC 4.0.
