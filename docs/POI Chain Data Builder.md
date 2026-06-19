# POI Chain Data Builder

Diese Notiz beschreibt die Datenbasis fuer progressive POI-Ketten. Sie ist
absichtlich vor Runtime-, Voice- und Overlay-Integration angesiedelt: Erst muss
stabil klar sein, ob die lokalen Tiles eine fachlich sinnvolle Kette liefern.

## Ziel

Eine POI-Kette ist eine Mission mit mehreren realen Zielpunkten entlang eines
Leitobjekts, zum Beispiel:

- Bruecken entlang eines Flusses
- Anschlussstellen oder Bauwerke entlang einer Autobahn
- Bahnhoefe, Weichen- oder Uebergangsgruppen entlang einer Bahnstrecke
- Umspannwerke, Schaltanlagen oder markante Trassenpunkte entlang einer
  Stromleitung

Die Runtime soll spaeter nicht nachtraeglich suchen. Die Kette wird vorher
vollstaendig gebaut, bewertet und gespeichert. Im Flug ist nur der aktuelle
naechste Punkt sichtbar; nach Erreichen wird der naechste Punkt freigegeben.

## Datenquellen

Der Builder kombiniert drei vorhandene Tile-Layer:

- `core.lin`: Leitobjekt-Samples fuer Fluss, Strasse, Bahn oder Trasse
- `infra.poi` und `infra.clusters`: technische Zielkandidaten
- `poi.poi`: ergaenzende POIs, besonders Autobahnanschlussstellen

Damit sind keine grossen Vektorlinien im Client notwendig. Die erste Ordnung
erfolgt ueber Start/Ende, die Kandidaten muessen aber zur tatsaechlichen
Leitpunktspur aus `core.lin` passen. Dadurch werden Nebenobjekte reduziert, die
zwar nahe an der Luftlinie liegen, aber nicht zum eigentlichen Korridor gehoeren.

## Ablehnung statt schlechte Kette

Eine Kette wird nur als `ready` akzeptiert, wenn genug Grundlage vorhanden ist:

- Start und Ende sind gueltig.
- Genug Leitpunkte passen zu Typ und Name des Korridors.
- Genug Kandidaten liegen nahe an der Leitpunktspur.
- Clustering und Mindestabstand lassen noch genug Zielpunkte uebrig.

Wenn das nicht klappt, liefert der Builder bewusst einen Status wie
`insufficient_corridor`, `insufficient_candidates` oder `insufficient_chain`.
Missionen sollen dann auf ein anderes Profil oder eine einfache POI-Mission
zurueckfallen, nicht eine schwache Kette erzwingen.

## Dryrun

Der lokale Pruefstand laedt echte lokale Tiles:

```bash
node --check mission-poi-chain.js
node --check tools/poi-chain-dryrun.mjs
node tools/poi-chain-dryrun.mjs --all
```

Einzelszenarien:

```bash
node tools/poi-chain-dryrun.mjs --scenario=kinzig_bridges_haslach_offenburg
node tools/poi-chain-dryrun.mjs --scenario=a5_junctions_lahr_achern
node tools/poi-chain-dryrun.mjs --scenario=rail_offenburg_hausach
node tools/poi-chain-dryrun.mjs --scenario=power_grid_offenburg_lahr
```

JSON-Ausgabe fuer Analyse:

```bash
node tools/poi-chain-dryrun.mjs --all --json --out=analysis/poi-chain-dryrun.json
```

Der Dryrun prueft zwei Ebenen:

- `buildPoiChain`: Kette aus einem vorgegebenen Korridor bauen.
- `buildPoiChainProspects`: aus den geladenen Tiles selbst passende
  Korridor-Gruppen finden und bewerten.

Die wichtigsten Kennzahlen sind:

- `guide`: passende Leitpunkte aus `core.lin`
- `raw`: rohe Kandidaten vor Clustering
- `clusters`: Kandidaten nach Raum-Clustering
- `selected`: finale Kettenpunkte
- `distCorridorNm`: Abstand des Zielpunkts zur Leitpunktspur

## Debug-Force im Dispatcher

Normale Infrastruktur-Inspektionen bleiben unveraendert, solange kein Debug
aktiv ist. Fuer gezielte Tests kann die Kettengenerierung im Browser erzwungen
werden:

```js
forcePoiChainDispatch()
forcePoiChainDispatch('river_bridge_inspection')
forcePoiChainDispatch('road_junction_survey')
forcePoiChainDispatch('rail_chain_inspection')
forcePoiChainDispatch('power_grid_inspection')
clearPoiChainDispatchForce()
```

Alternativ kann der versteckte Pickerwert `poi:chain+inspection_infra` genutzt
werden. Wenn keine stabile Kette gefunden wird, faellt der Dispatcher wieder auf
die normale POI-Suche zurueck.

## Runtime-Anschluss spaeter

Die Runtime konsumiert nur das `chain`-Objekt und liegt in
`mission-poi-chain-runtime.js`:

- `overlay`: Start/Ende und Korridor-Hinweis schon im Briefing sichtbar machen
- `points`: progressive Zielpunkte mit Trigger-Radius
- `sequenceRequired`: Reihenfolge erzwingen, wenn die Mission das verlangt
- `completionMode: all_required`: Auftrag erst nach allen Pflichtpunkten erfuellt

`passenger-voice.js` ruft die Runtime pro Positions-Tick auf und spricht nur
fertige Event-Texte. Aktuell werden kleine wiederverwendbare TTS-Clips fuer
`point_complete` und `chain_complete` vorgeladen; der konkrete naechste Punkt
wird ueber Missionsstatus und Orientierung genannt. Die Such- und
Bewertungslogik bleibt dabei im Builder und wandert nicht in
`passenger-voice.js`.
