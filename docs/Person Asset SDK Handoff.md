# Handoff an den SDK-Agenten – Personen-Figuren ins Homebase-Pack

Stand 12.11.2026 · vom Integrations-Agenten (App/Tracker).

Ziel: Jede neue Figur kommt so ins Pack `vfr-multitool-homebase-assets`, dass sie
**ohne Nacharbeit** in App, Workbench und Tracker erscheint. Seit Tracker v632 gilt
für die Homebase: Pack mit neuer Figur veröffentlichen → Figur ist als Mitarbeiter
wählbar. Keine neue EXE, keine Web-Änderung. Für Missionen gilt dasselbe, sobald
der Missions-Composer fertig ist – dafür braucht jede Figur jetzt schon den
Aussehens-Block (Abschnitt 3).

Hintergrund: [Mission Person Asset Plan](Mission%20Person%20Asset%20Plan.md).
Briefing für den 3D-Artist: [Person Asset Artist Briefing](Person%20Asset%20Artist%20Briefing.md).
Modellierung, Rig, Locomotion, Build und Texturen weiter nach
`HOMEBASE-INTEGRATION-ANIMIERTE-FIGUREN.md`, `ASSET-PIPELINE-REGELN.md`,
`HOMEBASE-ASSET-MODELLREGELN-AGENTEN.md`.

## 1. Katalogeintrag – Pflichtfelder

| Feld | Vorgabe |
|---|---|
| `key` | camelCase, eindeutig, **nach Release nie umbenennen** (Wanderin: `tumbleweedHiker`) |
| `folder` | `tw-pod-<rolle>`, mehrere Figuren einer Familie dürfen einen Ordner teilen |
| `title` | `tw-pod-<rolle>-<f\|m>-<NN>`, exakt wie in `sim.cfg`, **nach Release nie ändern**. Nie mit `Tarmac_` beginnen. Texturvarianten bekommen eigene Titel (`-02`, `-03`) |
| `label` | deutscher Anzeigename, z. B. „Techniker mit Warnweste“ |
| `kind` | `object` |
| `group` | `Personen` |
| `version` | Asset-Version |
| `homebasePlaceable`, `workbenchVisible` | `false` – Figuren sind keine platzierbaren Objekte; als Mitarbeiter erscheinen sie über den `person`-Block |
| `missionSpawnable` | `true` nach bestandener Abnahme (Abschnitt 6) |
| `missionRoles` | aus `passenger`, `scene-person`, `ground-crew`. **Nie** `scene-prop` oder `cargo` |
| `missionTags` | `person` + beschreibende Tags (Look, Requisiten). Keine Missionsarten |
| `headingCorrectionDeg` | `0`, wenn die Figur nach vorn blickt |
| `controls` / `animation` | `[]` / `null` |
| `person` | Pflichtblock, Abschnitte 2 und 3 |

## 2. `person` – Technik (liest der Tracker)

```json
"person": {
  "schemaVersion": 1,
  "gender": "female",
  "heightM": 1.775,
  "footprintRadiusM": 0.279,
  "locomotion": {
    "type": "waypoint-ground",
    "maxWalkKts": 3,
    "cleanWalkKts": [1.5, 2.8],
    "testedWalkKts": [1.5, 2.5, 3.1],
    "accelerationConstants": [1.8, 0.4],
    "decelerationConstants": [2.4, 0.4],
    "stopDistanceM": 0.9
  },
  "clips": ["standing_relax", "walk", "walk_slow", "walk_medium", "locomotion"],
  "lodCount": 1,
  "appearance": { "…": "Abschnitt 3" }
}
```

- `gender` `female`/`male` – bestimmt Stimme und die Tarmac-Ersatzfigur.
- `maxWalkKts` = `max_speed_knots` in `sim.cfg`, 1–5 kt. Natürlicher Gang 1,5–3 kt
  reicht; nicht auf 4,5 kt trimmen. App und Tracker begrenzen auf diesen Wert.
- `cleanWalkKts` [min, max], max ≤ `maxWalkKts`; `testedWalkKts` = im Sim geprüfte Solltempi.
- `heightM` 0,5–2,3 m, `footprintRadiusM` 0,1–1,5 m inkl. fester Requisiten.

## 3. `person.appearance` – Aussehen (liest später der Missions-Composer)

```json
"appearance": {
  "look": "outdoor",
  "ageBand": "young_adult",
  "season": "all",
  "props": ["backpack_large"],
  "uses": ["passenger", "pickup", "bystander", "escort", "homebase"],
  "description": "Junge Frau in Wanderhose und Funktionsjacke mit großem Trekkingrucksack"
}
```

Nur Werte aus `data/mission-person-vocabulary.json` (verbindliche Liste):

| Feld | Werte |
|---|---|
| `look` (genau einer) | `casual`, `outdoor`, `workwear`, `business`, `aviation`, `medical`, `fire_rescue` |
| `ageBand` | `child`, `young_adult`, `adult`, `senior` |
| `season` | `summer`, `winter`, `all` |
| `props` (fest am Modell, Liste, darf leer sein) | `backpack_large`, `backpack_small`, `camera`, `binoculars`, `headset`, `clipboard`, `tablet`, `helmet`, `hi_vis_vest`, `radio`, `medical_bag`, `briefcase`, `hat` |
| `uses` (mind. einer) | `passenger`, `pickup`, `ground_crew`, `bystander`, `escort` (bringt/holt jemanden ab), `patient` (reist als gehfähiger Patient), `homebase` |
| `description` | ein Satz, höchstens 200 Zeichen, **nur was man sieht** – keine Missionsarten, keine Geschichte, keine Namen |

Den Vorschlag liefert der 3D-Artist mit dem Modell als Datei
`<folder>/person-appearance.json` (Schema `person-appearance.v1`, Beispiel
`docs/examples/person-appearance.tw-pod-hikers.json`,
[Briefing](Person%20Asset%20Artist%20Briefing.md) Abschnitt 4). Die Datei bleibt in
der Rohquelle `Quellen/<folder>/`. Ablauf:

1. `node tools/check-person-appearance.mjs Quellen/<folder>/person-appearance.json`
2. Am fertigen Modell prüfen, bei Bedarf in der Datei korrigieren.
3. Je Figur übernehmen: `appearance` → `person.appearance`, `gender` → `person.gender`,
   `measured.*` → `person.heightM` / `person.footprintRadiusM`, `locomotion.*` →
   `person.locomotion`, `clips`, `lodCount`.

`tools/release-homebase-pack.mjs` prüft beim Release, dass Katalog und Steckbrief
übereinstimmen. Prüfe ihn gegen das fertige
Modell (z. B. Ärmel → `season`) und übernimm ihn in den Katalog. Ein Wert, der
nicht in der Liste steht, wird vorher mit dem User abgestimmt – nicht einfach
ergänzen.

## 4. Wanderin vervollständigen

`tumbleweedHiker` bekommt mit dem nächsten Pack `person.appearance` wie im Beispiel in
Abschnitt 3 (inkl. `escort` und `homebase` in `uses`). Sonst keine Änderung an Key, Titel oder Modell.

## 5. Paket und Ablage

- Alle Figuren ins gemeinsame Pack, Ablage unter `SimObjects/Misc/<folder>` –
  der Tracker prüft beim Update `sim.cfg` nur dort (0.6.26 bestätigt: Lauf funktioniert).
- **Publisher:** `person` vollständig übernehmen, auch den neuen Unterblock
  `appearance`. Nachweis im Selbsttest: Block identisch in Import, `catalog.json`
  und `package-index.json`.
- LOD01/LOD02 nachreichen, sobald vorhanden. Texturgröße nach Textur-Pipeline.
- Paketversion erhöhen. **Veröffentlichen nur nach OK des Users.**

## 6. Abnahme je Figur (Protokoll mitliefern)

Isoliert und im Produktionspaket, im freien Flug am Boden:

1. Spawn per exaktem Titel, `ObjectAdded` mit Object-ID.
2. Wegpunkt 12 m bei 2,5 kt und bei `maxWalkKts`: Geschwindigkeit, Strecke, Halt.
3. Sicht: Stand, erster Schritt, Fußkontakte, Abstellschritt, Blickrichtung.
4. Zwei Figuren gleichzeitig mit getrennten Wegpunkten.
5. Entfernen, kein Wiedererscheinen. Stichprobe: Hangar und ein Koffer spawnen weiter.

## 7. Release-Ablauf (ab 0.6.27)

1. Du baust das Pack, legst den Staging-Branch `staging/homebase-assets-<version>`
   an (Katalog, `releases/<version>/package-index.json`, Rohquellen) und
   veröffentlichst nach OK das GitHub-Release `homebase-assets-v<version>` mit
   genau `package-index.json` und dem Vollarchiv. **`stable.json` nicht ändern.**
2. Der Integrations-Agent prüft auf dem Staging-Branch:
   `node tools/release-homebase-pack.mjs --version <version>`.
   Das Skript lädt Release und Archiv, prüft Hash, jede Datei, `layout.json`,
   `sim.cfg` unter `Misc`, Katalog-Gleichheit, alle Personen (Abschnitte 1–3),
   erzeugt die Missionslisten neu und lässt die Tests laufen.
3. Nach OK des Users: `--write-channel`, Commit, Merge nach `main`.

Fehler aus dem Skript kommen als Liste an dich zurück. Hinweise (z. B. fehlendes
`appearance`) blockieren nicht, sollen aber im nächsten Pack behoben werden.

## 8. Handover je Figur (Checkliste)

- [ ] Rohquelle `Quellen/<folder>/` vollständig
- [ ] Blender-Master mit Rig, Actions, Texturen
- [ ] Katalogeintrag mit `person` inkl. `appearance` (Abschnitte 1–3)
- [ ] Aussehens-Vorschlag des Artists und was du daran geändert hast
- [ ] Importfragment, Publisher-Selbsttest
- [ ] Live-Test-Protokolle (Abschnitt 6), Ablagepfad, Paketversion
- [ ] Textfassung als `.md` (Ergebnis + offene Punkte)

Rückfragen über den User. Der Integrations-Agent ändert ohne Abstimmung nichts
an Pack, Katalog-Identität oder Titeln.
