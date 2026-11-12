# Mission Person Asset Plan – Pax und Cargo gemeinsam darstellen

Stand 10.11.2026 · Konzept, noch nicht umgesetzt. Umsetzung schrittweise nach
Freigabe durch den User (betrifft die Pax-Auswahl aller Missionsarten).

Bezug: [Mission Scene Asset Strategy](../data/mission-scene-asset-strategy.md),
[Mission Semantics Rules V4](Mission%20Semantics%20Rules%20V4.md),
[Homebase-Assetauslieferung](homebase-asset-delivery.md),
SDK-Vorgabe für neue Figuren: [Person Asset SDK Handoff](Person%20Asset%20SDK%20Handoff.md).
Personenliste für das Modelling: `analysis/personen-figuren-liste-2026-11-10.pdf` (lokal).

## 1. Ziel

Was am Boden steht, soll den Zweck der Mission zeigen: Pax-Figur und Gepäck
gemeinsam. Beispiele, die **nicht** fest hinterlegt werden, sondern sich aus der
Geschichte ergeben sollen:

- Freizeitkleidung + Kamerakoffer → Fotoflug
- Arbeitskleidung + Kamera/Messkoffer → Vermessung, Inspektion
- feine Kleidung + Kamerakoffer → Charter für einen Hochzeitsfotografen
- Outdoor + Campingausrüstung → Bush-Abenteuer

Keine starren Kombi-Tabellen. Die KI stellt aus der Geschichte zusammen, was
mitfliegt; der Code sichert nur Katalog, Plausibilität und Wiederholbarkeit.

Neue Figuren und Cargo-Stücke sollen mit einem Profileintrag in **allen**
Missionen nutzbar sein, ohne neue Stichwortregeln.

## 2. Ist-Stand (Bestandsaufnahme 10.11.2026)

**Personen-Assets**
- Nur MSFS-Standardfiguren: 24 Tarmac-Personen (laufen bestätigt), Marshaller
  (nur Szene, nicht in der Laufliste), 3 Rettungsziele.
- Erste eigene Figur: Wanderin `tw-pod-hiker-f-01` (Key `tumbleweedHiker`),
  Asset 0.1.7 mit Idle + Walk. Am 11.11.2026 im lokalen Pack 0.6.26
  (unveröffentlicht) unter `SimObjects/Misc/tw-pod-hikers` abgenommen: Spawn,
  Wegpunktlauf 2,5/3,0 kt, zwei Figuren gleichzeitig, Entfernen. Katalog mit
  `person`-Block, Rollen `passenger`/`scene-person`, `missionSpawnable: true`.
  Aussehensprofil liegt als Fragment vor. LOD01 folgt später.
  `SimObjects/Misc` ist Pflicht: Der Tracker-Updater prüft `sim.cfg` nur dort.
- MSFS-Kategorie `Human`; der Tracker bewegt Figuren per `AI WAYPOINT LIST`.

**Pax-Auswahl** (`sync.js` `_missionScenePassengerGender`,
`_missionScenePersonTitle`, `_missionSceneMovingPerson*`)
- Nur Geschlecht (Feld oder Regex auf den Rollentext), dann Hash-Auswahl aus 12
  Tarmac-Titeln. Sommer/Winter gemischt, keine Rolle, kein Alter.
- Gruppe = ein Manifest-Posten mit einem Geschlecht
  (`mission-cargo-core.js` `mission-passenger`).
- Tracker lässt höchstens 3 Personen einsteigen (`clampInt(..., 0, 3)`),
  Manifest erlaubt bis 6.
- `/^tarmac_/i` an drei Stellen (`mission-cargo-core.js` ~1821, ~4330,
  `sync.js` `_missionSceneMovingPersonCandidates`) ersetzt jeden anderen Titel.

**Cargo-Auswahl**
- KI-Zuordnung (`mission-cargo-visual-core.js`, Composer parallel zum Writer)
  nur für `apt-news-idea.v1`, `charter-idea.v1`, `sightseeing-idea.v1` und nur
  für Passagiergepäck. Sie sieht Rolle, Gepäckbeschreibung und Gewicht, aber
  nicht Anlass oder Aufgabe.
- Alle anderen Missionsarten: Stichwortsuche (`_missionSceneSemanticCargoAsset`)
  und feste Pools je TaskDomain (Feuer, SAR, Medizin, Tiere).

**Stimme**: nur Geschlecht + Hash. Kein Alter, kein Erscheinungsbild.

## 3. Zielbild

```
Idee / Profil ──► Bordliste (neutral, ohne Katalog)
                     │
                     ▼
            Boden-Composer (1 KI-Abruf, parallel zum Writer)
            sieht Bordliste + Auftrag + Look-Liste + Cargo-Formen
                     │
                     ▼
            Code: prüfen, konkrete Figur/Objekt wählen
                     │
                     ▼
            gespeichert in der Idee (Rückflug identisch) ──► Manifest ──► Tracker
```

1. **Bordliste** – früh in der Pipeline, dort wo die Idee entsteht. Die
   Ideen-KI beschreibt frei in Worten, was mitfliegt. Sie kennt keinen Katalog
   und bekommt keine Beispiele. Missionen ohne KI-Idee (Privatflug, Bush,
   Training …) füllen die Bordliste aus Profil und Persona.
2. **Boden-Composer** – ein gemeinsamer Abruf für Pax und Cargo, Nachfolger von
   `mission-cargo-visual-core.js`. Er wählt pro Pax einen Look und pro Cargo-Posten
   1–3 Packstücke aus den gemischten Listen, jeweils mit kurzem Grund.
3. **Code-Auflösung** – prüft die Wahl, wählt Figur und Variante, setzt Rückfall.
4. **Speicherung** – `groundVisual` in der Idee, analog zu `cargoVisual`, wird
   mit der Rückflug-Fortsetzung übernommen.

Grundsätze nach V4: Zieltyp und TaskDomain bleiben Primärfokus der Geschichte.
Der Composer stellt nur dar, er ändert die Mission nicht. Beschreibungen sind
Datenmaterial, keine Anweisung.

## 4. Datenformate (Entwurf)

### 4.1 Bordliste `mission-onboard.v1`

```json
{
  "schema": "mission-onboard.v1",
  "occasion": "Hochzeit auf einem Weingut, Luftaufnahmen des Brautpaars",
  "task": "Fotoflug",
  "passengers": [
    { "id": "pax1", "role": "Hochzeitsfotograf", "gender": "male",
      "appearance": "fein gekleidet, Anzug ohne Krawatte", "ageHint": "adult" }
  ],
  "cargo": [
    { "id": "c1", "owner": "pax1", "description": "Kameraausrüstung mit Drohne",
      "packaging": "Hartschalenkoffer", "weightLbs": 28, "use": "passenger_gear" }
  ]
}
```

- `gender` muss mit der Voice-Persona übereinstimmen.
- `appearance` und `ageHint` sind optional. Fehlen sie, entscheidet der Composer
  aus Rolle und Anlass.
- Eine Gruppe wird als einzelne Personen geführt (bis 6). Das Manifest kann
  weiter einen gemeinsamen Gewichtsposten bilden.

### 4.2 Composer-Ergebnis `mission-ground-visual.v1`

```json
{
  "schema": "mission-ground-visual.v1",
  "passengers": [ { "id": "pax1", "look": "business", "note": "festlicher Anlass" } ],
  "cargo": [ { "id": "c1", "pieces": [ { "form": "camera_kit", "weightLbs": 28 } ] } ]
}
```

Der Code ergänzt: konkrete Titel, Seed, Paketversion, Saison.

### 4.3 Personenprofile `data/mission-person-asset-profiles.json`

**Update 12.11.2026:** Das Aussehen eigener Figuren steht direkt im Pack-Katalog
(`person.appearance`, Werte aus `data/mission-person-vocabulary.json`). Der
3D-Artist schlägt es vor ([Artist Briefing](Person%20Asset%20Artist%20Briefing.md)),
der SDK-Agent prüft und trägt es ein
([SDK Handoff](Person%20Asset%20SDK%20Handoff.md)), und
`tools/release-homebase-pack.mjs` prüft es beim Release. Eine eigene Profildatei
braucht es nur noch für die Tarmac-Standardfiguren (`stock`); der Generator liest
eigene Figuren aus dem Katalog. Neue Figuren erscheinen damit ohne Nacharbeit.

```json
{
  "schema": "mission-person-asset-profiles.v1",
  "looks": {
    "casual":   { "label": "Freizeitkleidung, entspannt" },
    "outdoor":  { "label": "Funktionskleidung für draußen" },
    "workwear": { "label": "Arbeitskleidung, Warnweste oder Overall" },
    "business": { "label": "Gepflegt bis elegant, Anzug, Kostüm oder Kleid" },
    "aviation": { "label": "Fliegerisch, Polo/Hemd mit Headset" },
    "medical":  { "label": "Rettungsdienst oder Klinik" },
    "fire_rescue": { "label": "Feuerwehr- oder Brandschutz-Einsatzkleidung" }
  },
  "assets": {
    "tumbleweedHiker": { "look": "outdoor", "gender": "female", "ageBand": "young_adult",
      "season": "all", "props": ["backpack_large"], "uses": ["passenger", "pickup", "bystander"] }
  },
  "stock": [
    { "title": "Tarmac_Female_Summer_Caucasian", "look": "casual", "gender": "female",
      "ageBand": "adult", "season": "summer", "props": [], "uses": ["passenger", "bystander"] }
  ]
}
```

Die Tarmac-Personen werden als `stock` eingetragen. So bleibt jeder Look auch
ohne eigene Figur besetzt (z. B. Tarmac Winter → casual/winter).

## 5. Regeln für Composer und Code

**Composer bekommt**: Bordliste, Anlass/Aufgabe, Look-Liste und Cargo-Formen
(nur Kennung, neutrale Bezeichnung, Tags). Die Listen werden pro Mission
gemischt, ohne Beispiele und ohne Missionstyp-Zuordnung. Seltene Kombinationen
wie der Hochzeitsfotograf sind ausdrücklich erlaubt.

**Code prüft**:
- Look und Form existieren im Katalog, sonst Rückfall für diesen Posten.
- Geschlecht der Figur = Geschlecht der Pax/Stimme. Ohne passende Figur:
  gleicher Look mit Tarmac-Figur desselben Geschlechts.
- Saison nach Abflug-Wetter/Datum (Sommer/Winter) – das entscheidet der Code,
  nicht die KI.
- Anzahl Figuren = Anzahl Pax. Gewicht bleibt Manifest-Wert.
- Stabile Streuung bei gleich guten Figuren (Seed aus Missions-ID), damit nicht
  jede Mission dieselbe Person zeigt.

**Rückfall** (KI aus, Fehler, ungültige Antwort, Missionsart noch nicht
umgestellt): Code-Zuordnung über `roleProfile`/`taskDomain` → Look, dann
wie oben. Für Cargo bleibt die bisherige Zuordnung, bis die Missionsart
umgestellt ist.

## 6. Nötige Anpassungen außerhalb des Composers

- `/^tarmac_/i`-Prüfungen durch eine Katalogprüfung („ist Person-Asset“)
  ersetzen.
- Lauftempo je Figur: Der Tracker nimmt bisher 2,5–4,5 kt an und rechnet daraus
  die Laufzeit. Die Wanderin ist auf 3 kt begrenzt und lief im Test etwa
  2,3 kt. Der Katalog liefert künftig `maxWalkKts`; App und Tracker begrenzen
  darauf und rechnen die Laufzeit mit dem tatsächlichen Tempo.
- Gruppen: je Pax ein Figurobjekt im Manifest/Szene (`person_boarder_*`).
  Grenze 3 Einsteiger gegenüber 6 Pax klären (Leistung schwacher PCs beachten).
- Voice: Geschlecht der Figur und Stimme aus derselben Quelle. Optional später
  `ageBand` an die Stimmauswahl weitergeben.
- Persönliches Gepäck am Boden bleibt getrennt von festen Requisiten an der
  Figur (Rucksack am Modell ≠ Gepäckstück im Manifest).

## 7. Etappen

Ausführlicher Fahrplan mit allen Missionssträngen und Checkliste:
[Mission Ground Composer Fahrplan](Mission%20Ground%20Composer%20Fahrplan.md) (12.11.2026).

| Etappe | Inhalt | Ergebnis |
|---|---|---|
| 1 | Bordliste + Boden-Composer bauen, Personenprofile + Generator, `/^tarmac_/` ablösen. Reporter, Charter, Sightseeing umstellen (haben heute schon den Cargo-Composer). | Pax-Look und Gepäck kommen aus einem Abruf; Tarmac als Rückfall |
| 2 | Privatflug und Bush: Bordliste aus Persona/Profil, zunächst Code-Zuordnung, dann Composer. Wanderin einbinden. | Wanderin im Einsatz |
| 3 | Übrige Ideen-Pipelines einzeln (Medizin, Tiere, Verein, Fracht, Bio/Geo, Mapping, Infra, Feuer …), je mit Testschalter. | Alle Missionen nutzen den Composer |
| 4 | Alte Stichwortzuordnung für Cargo und Regex-Geschlechtserkennung entfernen. | Eine Quelle für das Bodenbild |

Parallel dazu: Tempo je Figur und Gruppenfiguren (Abschnitt 6) – sobald die
Wanderin im Pack ist, da Tracker-Änderung mit EXE-Build (nur nach User-OK).

Tests je Etappe: Unit-Tests für Validierung/Rückfall/Saison/Geschlecht,
Gemini-Live-Proben mit ungewöhnlichen Anlässen (Hochzeit, Trauerflug,
Firmenjubiläum), Rückflug-Identität, Sim-Test Einsteigen/Aussteigen mit eigenen
Figuren und Tarmac gemischt.

## 7a. Homebase-Mitarbeiter mit eigenen Figuren (12.11.2026)

Unabhängig von den Missionsetappen können Figuren mit `person`-Block als
Homebase-Mitarbeiter laufen. Vorher waren Mitarbeiter fest auf die 24
Tarmac-Personen beschränkt.

- **Tracker:** `homebase-asset-catalog.js` registriert Personen aus dem
  installierten Pack getrennt von Objekten (`registerRuntimePeople`,
  `personModelForTitle`). Pflicht: `kind: object`, `person.gender`
  female/male, `locomotion.type: waypoint-ground`, `maxWalkKts` 1–5, Titel
  ohne Tarmac-Präfix. Die Objektregel (Titel „VFR Multitool Homebase …“)
  bleibt unverändert; Figuren sind nie platzierbare Objekte.
  `homebase-object-manager.js` nimmt Tarmac, installierte Figur oder den
  mitgeschickten Tarmac-Ersatz (`fallbackTitle`, Log
  `HOMEBASE_PERSON_FALLBACK`) und begrenzt das Tempo auf `maxWalkKts`.
  Fähigkeit `homebase-pack-people-v1`. `publicAssetCatalog` und der
  gespeicherte aktive Index reichen den `person`-Block weiter.
- **Workbench:** Installierte Figuren stehen unter „Eigene Figuren“. Jede
  Figur bekommt einen Tarmac-Ersatz gleichen Geschlechts
  (`Tarmac_Female_Summer_Caucasian` / `Tarmac_Male_Summer_Caucasian`).
  Gespeicherte Figuren bleiben erhalten, auch wenn der Tracker sie (noch)
  nicht meldet; dann gehen sie als Ersatzfigur an den Tracker.
- **App/Szenenkern:** `normalizePersonModel` lässt eigene Figuren nur mit
  gültigem Tarmac-Ersatz durch. `homebase-integration.js` schickt Trackern
  ohne `homebase-pack-people-v1` den Ersatz (eigene Homebase und Crew).
- **Worker:** `normalizeHomebasePerson` speichert eigene Figuren nur mit
  Tarmac-`fallbackTitle`. Reihenfolge beim Ausrollen: Worker vor Web,
  sonst verwirft ein alter Worker die Person aus dem Cloud-Plan.

Tests: `ga-tracker-client/homebase-pack-people.test.js`,
`tools/homebase-scene-core.test.cjs` (Pack-Figuren),
`tools/cloudflare-worker/homebase-sync.test.mjs` (Pack-Figur mit/ohne Ersatz).
Workbench im Browser mit nachgestellter Tracker-Meldung geprüft (Auswahl,
Tempo 3 kt, Erhalt ohne Meldung). Sim-Abnahme steht aus.

## 7b. Pack-Release prüfen (ab 0.6.27)

`node tools/release-homebase-pack.mjs --version <x.y.z>` auf dem Staging-Branch:
lädt Release-Index und Vollarchiv, prüft Größe, SHA-256, jede Datei,
`layout.json`, `manifest.json`, `sim.cfg` unter `SimObjects/Misc`, Gleichheit
von Release-Katalog und `catalog.json`, alle Personen
(`tools/homebase-person-rules.mjs`), erzeugt die Missionslisten neu und lässt
die Tests laufen. `--write-channel` schreibt `stable.json` erst nach OK. Kein
Commit, kein Push.

## 8. Offene Punkte

- Wo genau die Bordliste je Ideen-Schema entsteht (eigenes Feld in den
  Ideen-Prompts oder Ableitung aus vorhandenen Feldern wie `shipment`,
  `luggageLabel`, `passenger`).
- Zusätzlicher KI-Abruf bei bisher composer-losen Missionsarten: Kosten pro
  Mission, Verhalten ohne KI-Modus.
- Ablageort der Figuren im Pack (`SimObjects/Humans` vs. Publisher-Standard
  `SimObjects/Misc`) – klärt der SDK-Agent.
- Welche Looks mit eigenen Figuren besetzt werden, entscheidet die
  Modelling-Abstimmung (Personenliste, Grund-Looks).
