# Handoff an den SDK-Agenten – Personen-Figuren ins Homebase-Pack

10.11.2026 · vom Integrations-Agenten (App/Tracker) · gilt für die Wanderin und
alle weiteren animierten Personen.

Ziel: Jede Figur kommt so ins Pack `vfr-multitool-homebase-assets`, dass die
App sie später ohne Nacharbeit als Pax, Bodenpersonal oder Zuschauer einsetzen
kann. Hintergrund und App-Seite: [Mission Person Asset Plan](Mission%20Person%20Asset%20Plan.md).

Was hier nicht geregelt ist (Modellierung, Rig, Locomotion-Kopplung, Build,
Textur-Pipeline), gilt weiter nach euren Dokumenten
`HOMEBASE-INTEGRATION-ANIMIERTE-FIGUREN.md`, `ASSET-PIPELINE-REGELN.md`,
`HOMEBASE-ASSET-MODELLREGELN-AGENTEN.md` und der Wanderin-Übergabe 0.1.7.

## 1. Sofort an der Wanderin ändern

| Feld | bisher (0.1.7) | neu |
|---|---|---|
| `missionRoles` | `["scene-prop"]` | `["passenger", "scene-person"]` |
| `missionTags` | `person, hiker, passenger` | `person, hiker, outdoor, backpack` |
| `person` | – | Block nach Abschnitt 3 |

**Warum:** `scene-prop` übernimmt der Szenen-Generator
(`tools/generate-homebase-scene-assets.mjs`) als stehende Deko in Missionsszenen,
sobald `missionSpawnable` `true` ist. Personen sollen dort nicht als Deko
landen. `passenger` und `scene-person` werden heute von keinem Generator
gelesen. Die Figur ist dadurch im Pack, ohne schon Missionen zu verändern.
Rollen gehören nach `missionRoles`, nicht nach `missionTags`.

## 2. Katalogeintrag – Pflichtfelder

Gemeinsames Schema wie bisher (`homebase/assets/catalog.json`,
`homebase-asset-catalog.js`, `Quellen/publisher-import-manifest.json`). Für
Personen gilt:

| Feld | Vorgabe |
|---|---|
| `key` | camelCase, eindeutig, **nach Release nie umbenennen**. Wanderin bleibt `tumbleweedHiker`. Neue: frei wählbar, z. B. `tumbleweedTechnicianM` |
| `folder` | `tw-pod-<rolle>` (mehrere Figuren einer Familie dürfen einen Ordner teilen, wie bei Hikers) |
| `title` | `tw-pod-<rolle>-<f\|m>-<NN>`, z. B. `tw-pod-technician-m-01`. Exakt wie in `sim.cfg`. **Nach Release nie ändern.** Texturvarianten bekommen eigene Titel (`-02`, `-03`) |
| `label` | deutscher Anzeigename, z. B. „Techniker mit Warnweste“ |
| `kind` | `object` (kein neuer Wert – Tracker und Workbench kennen nur `object`, `hangar`, `internal`) |
| `group` | `Personen` |
| `version` | Asset-Version, z. B. `0.1.7` |
| `homebasePlaceable`, `workbenchVisible` | nach Abnahmestand; erst `true`, wenn der Workbench-Test bestanden ist |
| `missionSpawnable` | `true`, sobald Spawn, Laufen und Entfernen im Produktionspaket bestätigt sind |
| `missionRoles` | Auswahl aus `passenger`, `scene-person`, `ground-crew`. **Nie** `scene-prop` oder `cargo` |
| `missionTags` | `person` + beschreibende Tags aus Abschnitt 4 (Look, Requisiten). Keine Missionsarten |
| `headingCorrectionDeg` | `0`, wenn die Figur in +Z/Vorwärts blickt; sonst Korrekturwert |
| `controls` | `[]` |
| `animation` | `null` (Locomotion läuft im Model Behavior, nicht über L:Vars der App) |
| `person` | Pflichtblock, Abschnitt 3 |

## 3. `person`-Block (Technik, liest der Tracker)

```json
"person": {
  "schemaVersion": 1,
  "gender": "female",
  "heightM": 1.68,
  "footprintRadiusM": 0.35,
  "locomotion": {
    "type": "waypoint-ground",
    "maxWalkKts": 3.0,
    "cleanWalkKts": [1.5, 3.0],
    "testedWalkKts": [2.5],
    "accelerationConstants": [1.8, 0.4],
    "decelerationConstants": [2.4, 0.4],
    "stopDistanceM": 0.9
  },
  "clips": ["standing_relax", "locomotion"],
  "lodCount": 1
}
```

| Feld | Bedeutung |
|---|---|
| `gender` | `female` oder `male` – muss zur Figur passen, die App koppelt daran die Stimme |
| `heightM` | gemessene Körpergröße im Modell |
| `footprintRadiusM` | Planungsradius inkl. Rucksack/Requisite, für Abstände in Szenen |
| `maxWalkKts` | = `max_speed_knots` aus `sim.cfg` |
| `cleanWalkKts` | Tempobereich, in dem die Animation sauber aussieht (min, max) |
| `testedWalkKts` | im Sim tatsächlich geprüfte Solltempi |
| `acceleration…`, `deceleration…`, `stopDistanceM` | Werte aus `sim.cfg` |
| `clips` | Clipnamen im gebauten Modell |
| `lodCount` | Anzahl LODs |

**Tempo (Entscheidung 10.11.2026):** Figuren werden **nicht** auf 4,5 kt
getrimmt. Jede Figur trägt ihr echtes Tempo ein, und App und Tracker rechnen
künftig damit. Ziel ist ein natürlicher Gang von etwa 1,5–3 kt. Wanderin laut
Sichttest 0.1.7: `maxWalkKts 3.0`, `cleanWalkKts [1.5, 2.8]`,
`testedWalkKts [1.5, 2.5, 3.1]` (gemessen 1,48 / 2,31 / 2,76 kt).

## 4. Aussehen – Profilwerte je Figur mitliefern

Diese Werte trägt der Integrations-Agent in
`data/mission-person-asset-profiles.json` ein. Bitte je Figur als
`person-profile.fragment.json` im Handover mitgeben. **Nur Werte aus den
Listen verwenden.** Neue Werte vorher mit dem User abstimmen.

```json
{
  "tumbleweedHiker": {
    "look": "outdoor",
    "gender": "female",
    "ageBand": "young_adult",
    "season": "all",
    "props": ["backpack_large"],
    "uses": ["passenger", "pickup", "bystander"],
    "description": "Junge Frau in Wanderhose und Funktionsjacke mit großem Trekkingrucksack"
  }
}
```

| Feld | erlaubte Werte |
|---|---|
| `look` (genau einer) | `casual` Freizeit · `outdoor` Funktionskleidung · `workwear` Warnweste/Overall · `business` gepflegt bis elegant · `aviation` fliegerisch · `uniform` Rettung/Feuerwehr |
| `gender` | `female`, `male` |
| `ageBand` | `child`, `young_adult` (bis ca. 30), `adult`, `senior` |
| `season` | `summer`, `winter`, `all` (kurze Ärmel/Shorts = summer, dicke Jacke/Mütze = winter) |
| `props` (fest am Modell) | `backpack_large`, `backpack_small`, `camera`, `binoculars`, `headset`, `clipboard`, `tablet`, `helmet`, `hi_vis_vest`, `radio`, `medical_bag`, `briefcase`, `hat` |
| `uses` | `passenger`, `pickup`, `ground_crew`, `bystander`, `homebase` |
| `description` | ein neutraler Satz: **was man sieht**. Keine Missionsarten, keine Geschichte („ideal für Hochzeiten“ o. Ä. weglassen) – die KI soll selbst kombinieren |

Requisiten sind nur das, was fest am Modell hängt. Gepäck am Boden (Koffer,
Kamerakoffer, Kühlbox) stellt die App über das Cargo-System – nicht ins Modell
bauen.

## 5. Paket und Ablage

- Alle Figuren ins gemeinsame Pack `vfr-multitool-homebase-assets`, kein
  eigenes Paket. Testpaket `vfr-multitool-hiker-test` vor dem Produktionstest
  aus dem Community-Ordner nehmen (gleicher Titel).
- **Ablageort klären:** Getestet wurde `SimObjects/Humans/tw-pod-hikers` mit
  `category = Human`, der Publisher legt unter `SimObjects/Misc` ab. Im
  Produktionspaket prüfen, ob Spawn **und Wegpunktlauf** unter `Misc`
  funktionieren. Wenn nicht: Publisher so erweitern, dass Personen unter
  `SimObjects/Humans/<folder>` landen, und das im Handover vermerken.
- **Publisher muss den `person`-Block durchreichen.** In der Repo-Kopie
  `tools/VFR-Multitool-Homebase-Asset-Publisher-v0.4.0-…/publisher-core.mjs`
  baut der Import jeden Eintrag aus festen Feldern neu auf. Felder aus dem
  Import, die im bisherigen Eintrag fehlen, gehen verloren. Bitte im aktuellen
  Publisher `person` aus dem Import übernehmen (und in `normalizeAssetEntry`
  nicht entfernen). Danach im erzeugten `catalog.json` und im `package-index.json`
  prüfen, dass der Block vollständig ankommt. `kind` muss dort `object`,
  `hangar` oder `internal` sein, deshalb bleibt es bei `object`.
- Leistung: mehrere Figuren gleichzeitig (bis 3–6 Pax plus Bodenpersonal).
  Wenn möglich LOD01/LOD02 nachreichen; Texturgröße nach Textur-Pipeline.
- Paketversion erhöhen, Release nach `docs/homebase-asset-delivery.md`
  (Stable-Kanal, Vollarchiv, Index). **Veröffentlichung nur nach
  ausdrücklichem OK des Users.**

## 6. Abnahme je Figur (Protokoll mitliefern)

Isoliert und anschließend im Produktionspaket, im freien Flug am Boden:

1. Spawn per exaktem Titel, `ObjectAdded` mit Object-ID.
2. Wegpunkt 12 m bei 2,5 kt und bei 4,0 kt (bzw. `maxWalkKts`): erreichte
   Geschwindigkeit, Strecke, Abstand zum Ziel, selbstständiger Halt.
3. Sicht: Stand vorher/nachher, Strecke bis zum ersten Schritt, Fußkontakte,
   Abstellschritt, Blickrichtung zum Ziel.
4. Zwei Figuren gleichzeitig mit getrennten Wegpunkten.
5. Entfernen, kein Wiedererscheinen.
6. Falls `homebasePlaceable`: Platzieren und Laden in der Workbench.

Protokoll als JSON wie `live-test-0.1.6.json`, ergänzt um Paketversion,
Ablagepfad und beide Tempi.

## 7. Handover-Inhalt je Figur (Checkliste)

- [ ] Rohquelle `Quellen/<folder>/` vollständig (sim.cfg, model.cfg, Modell-XML, glTF/BIN, Texturen + Sidecars)
- [ ] Blender-Master mit Rig, Actions, Texturen
- [ ] Katalogeintrag mit `person`-Block (Abschnitt 2 + 3)
- [ ] `person-profile.fragment.json` (Abschnitt 4)
- [ ] Importfragment für `publisher-import-manifest.json`
- [ ] Build- und Installationsprüfung, Live-Test-Protokolle (Abschnitt 6)
- [ ] Ablagepfad im Pack und Paketversion
- [ ] offene Punkte und bekannte Schwächen (z. B. Gleiten, Tempo-Obergrenze)

Rückfragen an den Integrations-Agenten über den User. Der Integrations-Agent
ändert ohne Abstimmung nichts an Pack, Katalog-Identität oder Titeln.
