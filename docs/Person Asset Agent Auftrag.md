# Arbeitsauftrag für den Asset-Agenten – Personen-Figuren (VFR Multitool)

Stand 12.11.2026. Lies zuerst diese Datei, dann `README-AGENT.md`, dann
`../3-technik/HOMEBASE-ASSET-BRIEFING-ANIMIERTE-FIGUREN.md`.

## 1. Kontext

- Ziel: animierte Personen für MSFS 2024, die am Boden stehen und über Wegpunkte gehen.
  Der Simulator bewegt die Figur (SimObject-Kategorie `Human`); die Animation macht die
  Pose. Die Bewegungssteuerung (Modell-XML, `sim.cfg`) baut der SDK-Kollege.
- Die App wählt Figuren nach ihrem **Steckbrief** aus. Der Steckbrief ist Pflicht.
- Referenz: die Wanderin `tw-pod-hiker-f-01` (`../4-referenz-wanderin/`,
  `beispiel/tw-pod-hikers/person-appearance.json`).
- Wunschliste: `../1-fuer-dich/Gewuenschte-Modelle.md`.

## 2. Was du lieferst (je Familie ein Ordner)

```
tw-pod-<familie>/
├── <Basisname>.blend
├── model/<Basisname>_LOD00.gltf
├── model/<Basisname>_LOD00.bin
├── model/<Basisname>_LOD01.gltf/.bin     optional
├── texture/<Textur>.png
├── texture/<Textur>.png.xml
├── person-appearance.json                 Steckbrief (Abschnitt 4)
├── Uebergabenotiz.md                      nach ../1-fuer-dich/Uebergabenotiz-Vorlage.md
└── vorschau/                              optional
```

Nicht liefern bzw. nicht ändern: `sim.cfg`, `model.cfg`, Modell-XML, Paket- oder
Katalogdateien. Diese erzeugt der SDK-Kollege.

## 3. Modell – harte Regeln

Details: `../3-technik/`. Die wichtigsten Punkte:

1. 1 Blender-Einheit = 1 Meter, echte Körperhöhe.
2. Ursprung am Boden zwischen den Füßen der neutralen Standpose; Figur blickt nach vorn
   (Vorderachse in der Übergabenotiz angeben).
3. Ein deformierendes Skelett und eine Ruhepose für alle Clips. Bewegung aus IK/Constraints
   für den Export auf die Bones backen.
4. Clips: `stand_neutral`, `standing_relax` (Füße bleiben am Boden), `walk` (Zyklus auf der
   Stelle, Anfang = Ende), `walk_start`, `walk_stop` (endet mit beiden Sohlen flach).
   Fußkontakte als Frames dokumentieren, Strecke je Zyklus in Metern angeben.
5. Natürlicher Gang 1,5–3 Knoten (0,8–1,5 m/s). Nicht auf hohes Tempo trimmen.
6. Feste Requisiten (Rucksack, Kamera, Headset …) gehören ins Modell. Gepäck am Boden
   (Koffer, Kisten, Kühlbox) nicht – das stellt die App.
7. Texturen als PNG unter `texture/`, glTF verweist als `../texture/<Datei>.png`, dazu die
   `.png.xml`-Sidecars. Siehe `../3-technik/ASSET-TEXTUR-PIPELINE.md`.
8. Schlank: bis zu sechs Figuren gleichzeitig. LOD01 wenn möglich.
9. Titel je Figur `tw-pod-<rolle>-<f|m>-<NN>`, nie `Tarmac_…`; Farbvariante = neuer Titel.

## 4. Steckbrief `person-appearance.json`

Ein Eintrag je Figur bzw. Farbvariante. Format: `person-appearance.schema.json`
(JSON Schema 2020-12). Erlaubte Werte: `mission-person-vocabulary.json`.

```json
{
  "schema": "person-appearance.v1",
  "folder": "tw-pod-technicians",
  "figures": [
    {
      "title": "tw-pod-technician-m-01",
      "workingName": "Techniker",
      "gender": "male",
      "appearance": {
        "look": "workwear",
        "ageBand": "adult",
        "season": "all",
        "props": ["hi_vis_vest", "helmet", "clipboard"],
        "uses": ["passenger", "ground_crew", "homebase"],
        "description": "Mann in orangefarbener Warnweste über blauem Arbeitshemd, weißer Helm, Klemmbrett in der Hand"
      },
      "measured": { "heightM": 1.82, "footprintRadiusM": 0.31 },
      "locomotion": { "maxWalkKts": 3, "cleanWalkKts": [1.5, 2.8] },
      "clips": ["stand_neutral", "standing_relax", "walk", "walk_start", "walk_stop"],
      "lodCount": 2,
      "knownIssues": []
    }
  ]
}
```

(Werte im Beispiel sind erfunden – miss die echten.)

### Regeln für die Felder

| Feld | Regel |
|---|---|
| `title` | exakt der spätere SimObject-Titel, Muster `^[A-Za-z0-9][A-Za-z0-9 _.-]{0,159}$`, nicht `Tarmac_…`, eindeutig |
| `gender` | `female` / `male` – muss zum Modell passen (die App wählt danach die Stimme) |
| `appearance.look` | genau einer: `casual`, `outdoor`, `workwear`, `business`, `aviation`, `medical`, `fire_rescue` |
| `appearance.ageBand` | `child`, `young_adult`, `adult`, `senior` |
| `appearance.season` | `summer` (kurze Ärmel), `winter` (dicke Jacke/Mütze), `all` |
| `appearance.props` | nur was fest am Modell hängt; Liste darf leer sein |
| `appearance.uses` | mindestens einer: `passenger`, `pickup`, `ground_crew`, `bystander`, `escort`, `patient`, `homebase` |
| `appearance.description` | ein Satz, max. 200 Zeichen, **nur sichtbare Merkmale** (Person, Kleidung, Farben, Requisiten). Verboten: Einsatzzweck („ideal für …“, „Mission“), Geschichte, Namen |
| `measured.heightM` | Scheitel bis Sohle in Metern (0,5–2,3) |
| `measured.footprintRadiusM` | größter horizontaler Abstand vom Ursprung inkl. Requisiten (0,1–1,5) |
| `locomotion.maxWalkKts` | höchstes Tempo, bei dem der Gang noch sauber aussieht (1–5) |
| `locomotion.cleanWalkKts` | [min, max] des sauberen Bereichs, max ≤ maxWalkKts |
| `clips` | Clipnamen exakt wie im glTF-Export |
| `lodCount` | Anzahl gelieferter Detailstufen (≥ 1) |

Leeres Gerüst: `vorlage/person-appearance.vorlage.json` (Platzhalter ersetzen).

## 5. Messen in Blender (Beispiel)

Größe und Platzbedarf aus der neutralen Standpose, inkl. Requisiten:

```python
# In Blender (Scripting-Tab), Armatur in der neutralen Pose (stand_neutral, Frame 1).
import bpy, math
from mathutils import Vector

deps = bpy.context.evaluated_depsgraph_get()
points = []
for obj in bpy.context.scene.objects:
    if obj.type != 'MESH' or obj.hide_render:
        continue
    mesh = obj.evaluated_get(deps).to_mesh()
    points += [obj.matrix_world @ v.co for v in mesh.vertices]
    obj.evaluated_get(deps).to_mesh_clear()

height = max(p.z for p in points) - min(p.z for p in points)
radius = max(math.hypot(p.x, p.y) for p in points)  # Ursprung liegt zwischen den Füßen
print(f"heightM={height:.3f} footprintRadiusM={radius:.3f}")
```

Gehtempo aus dem Zyklus: Strecke je vollständigem `walk`-Zyklus (m) ÷ Dauer (s) = m/s;
Knoten = m/s × 1,944. Beispiel: 2,4 m in 2,0 s = 1,2 m/s ≈ 2,3 kt.

## 6. Prüfen

```bash
node check-person-appearance.mjs tw-pod-technicians/person-appearance.json
```

Ausgabe muss mit `Bestanden` enden. `FEHLER` beheben, `HINWEIS` möglichst auch.
Alternativ mit einem JSON-Schema-Validator gegen `person-appearance.schema.json`
(z. B. `npx ajv-cli validate --spec=draft2020 -s person-appearance.schema.json -d <datei>`).
Das Prüfskript ist strenger (z. B. cleanWalkKts ≤ maxWalkKts, Wortwahl der Beschreibung)
und gilt als maßgeblich.

## 7. Vor der Übergabe (Checkliste)

- [ ] Ablauf Stand → Antritt → mehrere Gehzyklen → Abstellen → Stand im exportierten Modell geprüft
- [ ] glTF und bin aus demselben Export, Clipnamen und Dauer im Export kontrolliert
- [ ] Texturen unter `texture/` mit `.png.xml`, relative Pfade
- [ ] `person-appearance.json` „Bestanden“, Werte am fertigen Modell gemessen
- [ ] `Uebergabenotiz.md` ausgefüllt (Clipdaten, Strecke je Zyklus, Herkunft/Rechte)
- [ ] Titel folgen dem Muster und sind neu (nicht `tw-pod-hiker-f-01`)

## 8. Nicht tun

- Keine eigenen Werte in die Wortliste aufnehmen oder Werte umbenennen – nachfragen.
- Keine Einsatzzwecke in die Beschreibung.
- Keine `sim.cfg`, `model.cfg`, Modell-XML oder Paketdateien liefern oder ändern.
- Titel nach einer Lieferung nicht mehr ändern.
