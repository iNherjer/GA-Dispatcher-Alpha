# Gemeinsamer Lagebericht und Wetter für POI-Missionen

Verbindlicher Wiederverwendungspunkt für zukünftige POI-Briefing-Umbauten. Stand: 29.09.2026, Extraktion aus Alpha v1877. Die bisherige Foto-Mission ist der erste Verbraucher und das Umsetzungsmuster. Andere Profile werden durch diese Extraktion nicht automatisch aktiviert.

## Zuständigkeiten

| Baustein | Verantwortung |
| --- | --- |
| `mission-poi-briefing-shared-core.js` / `MissionPoiBriefingSharedCore` | Geometrie, belegte Umgebung, Landmarkenauswahl-Kontext, Lagebericht, Darstellung, Wetterrahmen/-Auflösung und gemeinsame Promptregeln |
| `mission-poi-briefing-shared-browser.js` / `MissionPoiBriefingSharedBrowser` | Lokale Tiles, zielgebundene Wiki-Belege, Umgebungsabruf, gemeinsamer Cache, Inflight-Zusammenführung und Anbieterpausen |
| `mission-private-episode-v6.js` | Bereits vorhandener APT-Wettervertrag: Werte, Referenzen, gleiche Stationsbeobachtung und Beobachtungsrückfall. Wird verwendet, nicht kopiert. |
| `mission-poi-briefing-core.js` | Nur Foto-Idee, Fotoauftrag, Writer-Prüfung, History, Foto-Missionsobjekt; delegiert Lage/Wetter an gemeinsame Logik |
| `mission-poi-briefing-browser.js` | Foto-Auswahl/Writer-Orchestrierung; nutzt beide gemeinsamen Bausteine |

Keine neue Runtime, Klassifikation, TaskDomain, Passenger-Rolle, Flughöhe oder Kreisbahn wird durch den gemeinsamen Baustein festgelegt. Andere POI-Profile verwenden ihre eigenen fachlichen Verträge. Lage und Wetter ergänzen den Auftrag.

## Anschluss eines weiteren Profils

Im Browser zuerst `mission-private-context-core.js`, den bestehenden APT-Wettervertrag (`mission-private-outing-core.js`, `mission-private-episode-v6.js`), dann Shared-Core und Shared-Browser laden. Erst danach das Profil. Die beiden Shared-Dateien sind in `index.html` und der SW-Assetliste eingetragen. CommonJS: `require('./mission-poi-briefing-shared-core.js')`.

```js
const common = window.MissionPoiBriefingSharedCore;
const sources = window.MissionPoiBriefingSharedBrowser;

// Ziel wurde vom bestehenden Profil gewählt; kein neuer Picker/Startpfad.
let context = await sources.context(destination, terrainEnvelope);
// Kontext darf im Ideen-Snapshot gespeichert werden.
// Erst NACH Auswahl einer Mission ergänzende Flächen abrufen:
context = await sources.enrichSelected(context, ensureAlive);
const flight = common.prepareFlight(missionContract);

// An den bestehenden Profil-Writer weitergeben:
const navigation = common.writerContext(context);
const instructions = common.navigationInstructions + '\n'
  + common.weatherInstructions(flight);
// Zusätzlich context.targetFacts, flight.context und flight.bindings liefern.
// Die profilabhängige Idee/Story/Person bleiben Sache dieses Writers.

// Nach dessen Antwort: narrative Felder nach Profilvertrag prüfen.
// report: {orientationIds: [...]} und flightBriefing sind ergänzende Felder.
const {report, reportStatus} = common.buildReport(raw.report, context);
const weather = common.resolveWeather(raw.flightBriefing, flight.context);
const briefing = [validatedStory, weather.flightBriefing,
  common.formatReport(report)].join('\n\n');
const evidence = common.sourceSnapshot(context);
// reportStatus, weather.flightBriefingStatus, Rohwettertext und evidence
// im bereits vorhandenen Debug-/Speichervertrag des Profils erhalten.
```

Ein Profil mit vorhandenem Geo-Kontext kann diesen direkt an `buildReport` übergeben, sofern er den unten beschriebenen Vertrag erfüllt. Ohne KI darf `buildReport(undefined, context)` die belegten Orientierungspunkte selbst auswählen; `resolveWeather('', flight.context)` stellt vorhandene Beobachtungen dar. Es ist kein zusätzlicher Modellaufruf notwendig.

## Öffentliche Schnittstellen

- `context(destination, terrainEnvelope = null)`: liefert einen Kontext für `{name, lat, lon}`; liest vorhandene lokale Tiles und passende Zielbelege. Keine Flächenabfrage für jeden Picker-Kandidaten.
- `enrichSelected(context, ensureAlive?)`: liefert eine ergänzte Kopie mit `environmentFacts` und zugehörigen `targetFacts`. Aufruf nur für das gewählte Ziel. Teilt Cache und Abrufpausen zwischen allen Profilen.
- `writerContext(context)`: begrenzte Landmarken/Hindernisse und Quellenreferenzen für den Writer.
- `buildReport(selection, context)`: `{report, reportStatus}`. Ungültige Orientierungsauswahl verwirft keine gültige Hauptgeschichte; Status `source-selection-fallback` statt `accepted-selection`.
- `formatReport(report)`: sichtbare Abschnitte „Lage und Orientierung“, „Geländehöhen“, „Hindernisse“. Interne Quellenbeschränkungen bleiben gespeichert, werden nicht als Abschnitt „Datengrundlage“ ausgegeben.
- `prepareFlight(contract)`: `{context, bindings}` aus dem vorhandenen V4-Wetterrahmen. Keine Wetterbeschaffung und keine erfundenen Beobachtungen.
- `resolveWeather(template, flightContext)`: `{rawFlightBriefing, flightBriefing, flightBriefingStatus}`; verändert keine Story.
- `sourceSnapshot(context)`: kompakter Quellenstand für Persistenz/Diagnose.
- `navigationInstructions` und `weatherInstructions(flight)`: gemeinsame Promptteile wiederverwenden, nicht erneut formulieren oder duplizieren.

Kontext-Mindeststruktur: `id`, `target`, `radiusM`, `facts: []`, `targetFacts: []`, `coverage: []`, `supplements: []`, `terrain: {status:'missing'}`. Optional `terrainEnvelope`, `environmentFacts`, `limitations`. Der Browser-Baustein liefert diese Struktur. Landmarken/Hindernisse im `facts`-Array besitzen stabile IDs, Quellen-Tags sowie beide Richtungsbezüge; eigene Kontextadapter dürfen die Bezugsrichtung nicht vertauschen. Das Höhenprofil nutzt `centerFt`, `maxFt`, `radiusNm`, `sampleCount` und `source:'terrarium-area'` für ein Flächenmaximum; fehlende Werte bleiben unbekannt.

## Belegregeln

- Orts-, Flur- und Straßennamen sind ausschließlich Bezeichnungen. Keine Umgebungseigenschaften aus Namen oder KI-Ortswissen ableiten.
- OSM-Tags und vollständige Geometrien begründen Landbedeckung und Lage. Innenringe werden als Aussparungen behandelt; fragmentierte Multipolygone werden ausgelassen.
- Distanzen bei Flächen beziehen sich auf den nächsten Rand. Aussagen zur Oberfläche am Zielpunkt beschreiben nicht automatisch das gesamte Bauwerk oder alle Portale.
- „Zwischen“, Hangseite, Waldrand oder Berglage nicht aus einfachen Nachbarschaften ableiten.
- Wiki-Belege verlangen passenden Zieltitel, Quellenlink und engen Koordinatenbezug. Der Baustein führt keine allgemeine KI-Webrecherche durch.
- Fehlende Treffer bedeuten weder offene Landschaft noch Hindernisfreiheit. Keine sichere Arbeitshöhe oder Flugfreigabe ableiten.

## Abrufe, Cache und bekannte Grenzen

Lokale Landmarken-/Hindernistiles: Radius 5556 m; der bisherige Tile-Pilot deckt 40–55° N und 0–20° E ab. Außerhalb keine stillschweigende weltweite Tile-Abdeckung behaupten. Die Übertragung auf weitere Profile erweitert die Datenabdeckung nicht.

Flächen: zunächst Overpass im Radius 1852 m, Deadline 10 Sekunden; bei Ausfall direkter OSM-JSON-Auszug mit 600 m Halbausdehnung, Deadline 8 Sekunden. Der kleinere Ersatzbereich ist keine vollständige Abdeckung von 1 NM. Geschlossene Flächen werden geprüft, Geometrien nicht in Missionen persistiert.

Gemeinsamer Cache `ga_poi_environment_v1`: maximal 32 Zielpunkte, zwölf Stunden bei Erfolg; kompakte Fakten, begrenzte lokale Speicherung. Kurze Fehlerzwischenspeicherung und anbieterbezogene Pausen (60 Sekunden), Inflight-Anfragen pro Ziel zusammengefasst. Storage- und Netzausfälle lassen das Briefing mit vorhandenen Belegen weiterlaufen.

Einzelabrufe der beiden Testorte lieferten reale Geometrien. Der spätere integrierte Netztest erhielt HTTP 406/429. Die Extraktion behebt diese Anbietergrenze nicht. Keine erfolgreiche neue Live-Netz- oder Simulatorprobe behaupten.

## Wetterverhalten

- `accepted-bindings`: gültige KI-Prosa mit vorhandenen Wetterreferenzen.
- `shared-observation`: identische Station, Beobachtungszeit und Werte; einmalige Darstellung mit beiden Stationsabständen.
- `observations-fallback`: ungültige/fehlende Prosa, aber vorhandene Beobachtungen werden dargestellt.
- `no-observations`: keine verwertbaren Beobachtungen; kurze ehrliche Datenlücke.

Fehlende Werte bedeuten keinen Wind von 0 kt; fehlende Böen sind nicht böenfrei. Die Stationsmeldung ist keine Strecken- oder Ankunftsprognose. Der gemeinsame POI-Baustein verändert den APT-Helfer nicht.

## Prüfungen und Referenzen

```sh
node --test tools/mission-poi-briefing-shared.test.cjs tools/mission-poi-environment.test.cjs tools/mission-poi-briefing.test.mjs
```

Der Extraktionstest vergleicht vollständige Foto-Briefings, Reports und Writer-Prompt-Prüfsummen mit `tools/fixtures/poi-shared-extraction-baseline.json` aus v1877. Zusätzlich: profilunabhängige Nutzung, Wetterrückfälle, Browser-Ladereihenfolge, Offline-Assetliste, Geometrien, Cache und Persistenz. Für breitere Änderungen die vorhandenen Wetter-/APT-Regressionssuiten mitlaufen lassen.

- [Foto-Mission als Umsetzungsvorlage](POI%20Photo%20Migration%20Template.md)
- [Umbauhistorie und Freigaben](POI%20Narrative%20APT%20Alignment.md)
- [Reale Umgebungsbelege](examples/POI%20Environment%20Evidence.md)
- [Beispielausgabe](examples/POI%20Situation%20Preview.md)


## Optionaler Cache-Lesezugriff für Infrastruktur-Ideen, 09.10.2026 (lokal)

`cachedEnvironment(context)` ergänzt ausschließlich bereits gültige, exakt
zielgebundene Flächenbelege des bestehenden Umgebungscaches. Kein Abruf und
kein Cache-Schreiben. Bei fehlendem Cache-Treffer wird der unveränderte Kontext
zurückgegeben; fehlende Belege bedeuten keine freie Fläche oder Hanglage.
Zunächst verwendet nur der Infrastruktur-Ideenrahmen diesen Zugriff.
`enrichSelected` und die Provider-/Geometrie-/Fristenregeln bleiben unverändert.
