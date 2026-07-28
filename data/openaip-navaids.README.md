# OpenAIP Navaid-Fallback

`openaip-navaids.json` ist ein kompakter, versionierter Fallback für Namen,
Kennungen, Frequenzen und Koordinaten von Navaids. Der Live-Regionscache bleibt
die primäre Quelle. Die statische Datei wird nur verwendet, wenn die
Navaid-Sammlung eines OpenAIP-Abrufs fehlt oder der Abruf vollständig ausfällt.

Die App lädt die Datei erst beim Öffnen des Kartentisches beziehungsweise beim
Aktivieren des Snappings. Sie wird nicht in `localStorage` kopiert, sondern über
den normalen Browser-/Service-Worker-Cache wiederverwendet. Für das aktive
Snapping werden nur Einträge innerhalb der aktuellen Kartenregion materialisiert.

## Aktualisieren

Vom Repository-Root:

```bash
node tools/build-openaip-navaids.mjs
node tools/openaip-navaids-selftest.mjs
node tools/openaip-navaid-fallback-selftest.mjs
```

Der Builder lädt die OpenAIP-Daten seitenweise mit maximal 250 Datensätzen pro
Request über den konfigurierten GA-Proxy. Eine abweichende Quelle oder Ausgabe
kann über `OPENAIP_NAVAIDS_SOURCE` beziehungsweise `OPENAIP_NAVAIDS_OUTPUT`
gesetzt werden.

## Quelle und Lizenz

Quelle: [OpenAIP](https://www.openaip.net/)

OpenAIP-Daten stehen unter
[Creative Commons Attribution-NonCommercial 4.0 International](https://creativecommons.org/licenses/by-nc/4.0/).
Die Quellen- und Lizenzangaben sind zusätzlich im JSON-Datensatz enthalten.
