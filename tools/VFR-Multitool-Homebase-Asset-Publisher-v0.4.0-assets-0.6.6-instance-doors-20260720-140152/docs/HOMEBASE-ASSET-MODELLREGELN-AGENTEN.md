# Verbindliche Modell- und Animationsregeln für Homebase-Assets

Stand: 17.07.2026

Dieses Dokument ist die technische Arbeitsanweisung für Agenten, die ein eigenes Homebase-3D-Asset neu erstellen oder ein bestehendes verändern. Ergänzend gelten `AGENTS.md` und `docs/ASSET-PIPELINE-REGELN.md`. Bei Widersprüchen gilt die strengere Sicherheits- oder Validierungsregel.

## 1. Auftrag und Änderungsumfang

Vor Beginn müssen mindestens Objektart, Optik und Einsatzzweck bekannt sein. Zusätzlich sind nach Bedarf Abmessungen, Varianten, Farben, sichtbare Details, Kataloggruppe, Homebase-Platzierung, Missionsverwendung, Animationen, Lichter, Kollision, Assetversion und geplante Paketversion zu klären.

Ein Modellauftrag erlaubt das Erstellen und Validieren der Quellen. Publisher-Import, SDK-Build, Release, Git-Push und Community-Installation sind nur bei ausdrücklichem Auftrag erlaubt.

Bei Änderungen an einem vorhandenen Asset bleiben ohne ausdrückliche Umbenennung stabil:

- Katalog-Key;
- SimObject-Ordnername;
- exakter `title` aus `sim.cfg`;
- Visual-GUID und vorhandene Animations-GUIDs;
- Namen bestehender Animationen, Nodes, Controls, Zustände und LVars.

Eine notwendige inkompatible Umbenennung muss als Migration behandelt und in Katalog, XML, Sidecar, Manifest und allen Verbrauchern gemeinsam umgesetzt werden.

## 2. Pflichtartefakte

Jedes Asset benötigt:

1. `C:\RohDaten\VFR-Multitool-Homebase-Asset-Publisher\asset-library\<SimObject-Ordner>\editable-source\<Basisname>.blend` als bearbeitbare Masterquelle.
2. `Quellen/<SimObject-Ordner>/sim.cfg`.
3. `Quellen/<SimObject-Ordner>/model/model.cfg`.
4. Genau die zur Modelldefinition gehörende XML sowie `*_LOD00.gltf` und `*_LOD00.bin` im `model`-Ordner.
5. Einen eindeutigen Eintrag in `homebase-asset-catalog.js`.
6. Einen passenden Eintrag in `Quellen/publisher-import-manifest.json`.
7. Bei Controls vorzugsweise `homebase-asset.json` in der Rohquelle; dessen Controls müssen mit dem Publisher-Katalog übereinstimmen.

Die zentrale Zuordnung und die SHA-256-Inventarliste werden mit `VFR-Multitool-Homebase-Asset-Publisher/tools/organize-asset-library.ps1` aktualisiert. Der jeweilige Bibliotheksordner `publisher-source` ist eine direkte Verzeichnisverknüpfung zur kanonischen Publisher-Rohquelle und darf nicht durch eine unabhängige Kopie ersetzt werden.

Texturen und weitere referenzierte Dateien müssen vollständig mitgeliefert werden. Die GLTF-Puffer dürfen nicht eingebettet sein, wenn die bestehende Assetstruktur eine externe BIN erwartet.

## 3. Blender- und Geometrieregeln

Verbindlich:

- Szeneneinheiten sind metrisch; `1 Blender Unit = 1 Meter`.
- Das Objekt besitzt reale, plausible Abmessungen.
- Der Ursprung ist für die spätere Platzierung bewusst gesetzt. Bei normalen Bodenobjekten liegt er auf der Aufstandsfläche, nicht in der geometrischen Mitte.
- Das Modell steht im Export ohne unbeabsichtigten Höhenversatz auf `Y=0` beziehungsweise auf der vom Exporter verwendeten MSFS-Hochachse.
- Vor dem Export sind unbeabsichtigte Translation, Rotation und Skalierung zu bereinigen. Negative oder nicht uniforme Skalierung darf nicht unbemerkt an Meshes oder Animationshierarchien verbleiben.
- Sichtbare Ausrichtung und `headingCorrectionDeg` werden gemeinsam geprüft.
- Mesh-, Node-, Material- und Animationsnamen sind stabil, eindeutig und sprechend.
- Materialien und Texturreferenzen dürfen nicht auf lokale absolute Künstlerpfade angewiesen sein.
- Animationen erhalten eigene, eindeutig benannte bewegte Nodes oder Bones. Der in der XML referenzierte Node muss im exportierten Modell existieren.
- Nicht sichtbare Hilfsgeometrie wird nicht versehentlich als Rendergeometrie exportiert.

Empfohlen:

- Transformationen vor dem Rigging beziehungsweise Animieren anwenden.
- Bewegliche Teile getrennt und mit sinnvoll gesetztem Dreh- oder Bewegungspunkt modellieren.
- Flächennormalen, harte Kanten, UVs, Alpha-Modi und Materialzuordnung vor Übergabe visuell prüfen.
- Polygonzahl und Texturauflösung dem sichtbaren Nutzen und der erwarteten Anzahl gleichzeitig platzierter Objekte anpassen.

## 4. Rohquellenformat

Minimalstruktur:

```text
<SimObject-Ordner>/
  sim.cfg
  homebase-asset.json        optional, bei Controls empfohlen
  model/
    model.cfg
    <Basisname>.xml
    <Basisname>_LOD00.gltf
    <Basisname>_LOD00.bin
```

Pflichtbedingungen:

- Der `title` in `sim.cfg`, Katalogtitel und Manifesttitel sind exakt gleich, einschließlich Groß-/Kleinschreibung und Leerzeichen.
- `model.cfg` verweist auf die vorhandene Modell-XML.
- XML, GLTF und BIN referenzieren einander korrekt.
- Die GLTF ist eine unkompilierte Rohquelle. `ASOBO_asset_optimized` darf nicht in `extensionsUsed` vorkommen.
- Rohquellen werden nur unter `Quellen/` vorbereitet beziehungsweise über die Dropzone nach `Homebase-Asset-Publisher-Data/source` importiert. Sie werden niemals direkt nach `community-package` oder in einen Community-Ordner kopiert.

## 5. Animation: durchgehender Vertrag

Eine steuerbare Animation funktioniert nur, wenn alle vier Ebenen übereinstimmen:

```text
Blender-Action/Clip und bewegter Node
        ↓ gleicher Animations- und Node-Name
GLTF-Animation
        ↓ XML bindet Animation und Node
Model-XML mit L:VFR_HOMEBASE_...-Ausdruck
        ↓ exakt dieselbe LVar und Zustandswerte
Publisher-Control im Katalog/Sidecar
```

Eine Animation nur in Blender oder GLTF ist nicht automatisch durch Homebase steuerbar.

### 5.1 Blender und GLTF

- Jede auszuliefernde Animation braucht einen eindeutigen Namen.
- Der Name muss beim Export erhalten bleiben und exakt dem XML-Feld `ANIM_NAME` beziehungsweise dem `<Animation name="...">` entsprechen.
- Der bewegte Node/Bone muss exportiert werden und exakt dem `Node` der XML-Komponente entsprechen.
- Anfang, Ende und Bewegungsrichtung werden schriftlich festgelegt. Für binäre Controls wird standardmäßig der normalisierte Bereich `0..100` verwendet.
- Der Clip darf keine unbeabsichtigte Bewegung des gesamten SimObjects enthalten.
- Bei einer geänderten Animation werden GLTF und BIN immer als zusammengehöriges Paar neu übergeben.

### 5.2 Model-XML

Für eine codegesteuerte Standardanimation wird das vorhandene MSFS-Schema verwendet. Beispiel:

```xml
<Animation name="RoundHangarDoor"
           guid="{EINDEUTIGE-STABILE-GUID}"
           type="Standard"/>
<Behaviors>
  <Include ModelBehaviorFile="Asobo\Generic.xml"/>
  <Component ID="RoundHangarDoor" Node="RoundHangarDoor">
    <UseTemplate Name="ASOBO_GT_Anim_Code">
      <ANIM_NAME>RoundHangarDoor</ANIM_NAME>
      <ANIM_CODE>(L:VFR_HOMEBASE_ROUND_HANGAR_DOOR_COMMAND, number) 0.5 &gt; if{ 100 } els{ 0 }</ANIM_CODE>
      <ANIM_LENGTH>100</ANIM_LENGTH>
      <ANIM_LAG>20</ANIM_LAG>
    </UseTemplate>
  </Component>
</Behaviors>
```

Regeln:

- Visual- und Animations-GUIDs sind gültig, eindeutig und nach Veröffentlichung stabil.
- Jede im Publisher deklarierte LVar muss als exakte Zeichenfolge in der Modell-XML vorkommen; sonst lehnt der Publisher die Quelle ab.
- `ANIM_LENGTH` entspricht dem in der GLTF/XML verwendeten Animationsbereich.
- `ANIM_LAG` und `durationMs` beschreiben gemeinsam die gewünschte Übergangsgeschwindigkeit und werden im Simulator abgeglichen. Werte dürfen nicht blind aus einem anderen Modell übernommen werden.
- XML-Sonderzeichen wie `>` und `<` werden korrekt als `&gt;` und `&lt;` geschrieben.

### 5.3 Publisher-Control

Aktuell zulässige Controls:

- `type`: `animation` oder `light`;
- nur für `kind: hangar` oder `kind: object`;
- `transport: simconnect-lvar`;
- `unit: number`;
- `scope: global` oder `scope: simobject`;
- bei `scope: global` eine LVar nach `^L:VFR_HOMEBASE_[A-Z0-9_]+$`;
- bei `scope: simobject` eine objektlokale Variable nach `^(L:1:|Z:)VFR_HOMEBASE_[A-Z0-9_]+$`;
- eindeutige Control-ID;
- mindestens zwei eindeutig benannte Zustände mit mindestens zwei verschiedenen endlichen Zahlenwerten;
- ein vorhandener Zustand als `defaultState`;
- optionale positive `durationMs`.

Beispiel für eine Tür:

```json
{
  "id": "door",
  "type": "animation",
  "label": "Tor",
  "transport": "simconnect-lvar",
  "simvar": "L:VFR_HOMEBASE_EXAMPLE_DOOR_COMMAND",
  "unit": "number",
  "scope": "global",
  "defaultState": "open",
  "durationMs": 5000,
  "states": [
    { "id": "open", "label": "Öffnen", "value": 0 },
    { "id": "closed", "label": "Schließen", "value": 1 }
  ]
}
```

Für Türen sind `id: door` und die Zustände `open`/`closed` mit `0`/`1` der Standard. Dadurch erzeugt der Publisher zusätzlich das kompatible Legacy-Feld `animation.type = door`.

`scope: global` bedeutet, dass mehrere gleichzeitig platzierte Instanzen mit derselben LVar denselben Steuerzustand erhalten können. Für eine unabhängige Steuerung je Instanz muss `scope: simobject` mit `L:1:VFR_HOMEBASE_...` oder `Z:VFR_HOMEBASE_...` verwendet werden; zusätzlich muss die Laufzeit den Wert gezielt an die konkrete SimObject-ID schreiben.

### 5.4 Lichtsteuerung

Ein Licht-Control folgt denselben LVar- und Zustandsregeln. Emissive Materialwirkung und echtes Licht sollen gemeinsam geschaltet werden. Die XML muss die LVar in den verwendeten Emissive-/Visibility-Ausdrücken enthalten. Die Zuordnung `0/1` zu an/aus wird im Control und in der XML identisch definiert; sie darf nicht stillschweigend invertiert werden.

Für ein tatsächlich funktionierendes MSFS-Licht gelten zusätzlich folgende Muss-Regeln:

- Das echte Licht besitzt in der rohen GLTF eine gültige `ASOBO_advanced_light`-Extension; `extensionsUsed` muss `ASOBO_advanced_light` enthalten.
- Der Light-Node ist Bestandteil der exportierten Szene und sein Name stimmt exakt mit dem `Node` der XML-Komponente überein.
- Farbe, Intensität, Richtung, Kegelwinkel, Quellradius sowie `channel_exterior` und `channel_interior` werden bewusst festgelegt und dokumentiert.
- Bei frei platzierten Homebase-SimObjects muss `channel_exterior: true` verwendet werden, solange ein erfolgreicher MSFS-Livetest nicht nachweist, dass ein reiner Innenkanal funktioniert. `channel_interior: true` allein kann bei einem nicht als Innenraum klassifizierten SimObject zu vollständig unsichtbarem Licht führen.
- Ein normaler Blender-GLTF-Export darf nicht als Beweis gelten, dass die MSFS-Light-Extension erhalten blieb. Wenn die Extension durch einen Nachbearbeitungsschritt ergänzt wird, gehört dieser Schritt verbindlich zum Exportverfahren.
- Nach dem SDK-Build wird erneut geprüft, dass Light-Node und `ASOBO_advanced_light` in der kompilierten GLTF vorhanden sind.
- Emissive-Fläche und reale Lichtabgabe werden getrennt geprüft: Eine leuchtende Materialfläche beweist nicht, dass das Licht die Umgebung beleuchtet; sichtbare Umgebungsbeleuchtung beweist nicht, dass das Emissive korrekt schaltet.
- Der definierte Standardzustand muss nach einem frischen MSFS-Start nachvollziehbar sein. Die XML-Ausdrücke und die Initialisierung der LVar dürfen sich nicht widersprechen.
- Ein Katalog-Control ist nur Metadatenbeschreibung. Bevor „schaltbar“ oder `LIVE-BESTÄTIGT` gemeldet wird, muss nachgewiesen sein, dass die tatsächlich ausgelieferte Homebase-/Tracker-Laufzeit die deklarierte LVar mit den vorgesehenen Werten schreibt.
- Der Livetest umfasst mindestens: frischer Simulatorstart, Asset neu erzeugen, Zustand „an“, Zustand „aus“, erneutes „an“, sichtbare Emissive-Reaktion, sichtbare reale Lichtwirkung und Verhalten nach Entfernen/Neuerzeugen.
- Wegen `scope: global` wird zusätzlich mit mindestens zwei gleichzeitig platzierten Instanzen geprüft und dokumentiert, ob beide gemeinsam reagieren. Eine unabhängige Instanzsteuerung darf daraus nicht abgeleitet werden.

Ein strukturell gültiger Publisher- oder SDK-Selbsttest ersetzt diesen Livetest nicht.

## 6. Ersetzen eines bestehenden Modells

Empfohlen ist der Import über die Publisher-Dropzone. Bei gleichem Asset ersetzt der Publisher den kanonischen Ordner atomar nach Validierung. Ein manuelles Kopieren nach `source` umgeht diese Prüfung und ist nur mit anschließender vollständiger Validierung zulässig.

Nach jeder Modelländerung:

1. Assetversion erhöhen.
2. Blender-Quelle und Rohquelle gemeinsam aktualisieren.
3. Bei Dropzone-Import vorhandenen Katalogeintrag gezielt ersetzen; keine zweite Identität anlegen.
4. Paketversion für eine neue Auslieferung erhöhen.
5. SDK-Projekt vollständig neu vorbereiten. Ein alter `sdk-project`-Stand ist kein Nachweis der Änderung.
6. Nur bei ausdrücklichem Auftrag SDK bauen, validieren, live testen und veröffentlichen.

Beim Publisher-Import erkennt der Publisher bestehende Assets über Key, Ordner oder exakten Titel und schlägt automatisch die nächste Patchversion vor. Eine neue Rohquelle muss eine höhere Assetversion erhalten. Vor dem Austausch muss die bisherige vollständige Quelle atomar unter `Homebase-Asset-Publisher-Data/source-history/<SimObject-Ordner>/<Assetversion>` gesichert werden; ein vorhandener abweichender Snapshot darf niemals überschrieben werden. Die gemeinsame Paketversion bleibt eine separate Releaseentscheidung.

## 7. Abnahmecheckliste für Agenten

- [ ] Auftrag, Maße, Optik, Zweck und steuerbare Funktionen sind dokumentiert.
- [ ] `.blend` liegt als bearbeitbare Masterquelle im passenden `asset-library/<SimObject-Ordner>/editable-source`-Ordner, ist metrisch und besitzt einen sinnvollen Ursprung.
- [ ] Maßstab, Bodenlage, Ausrichtung, Normalen, Materialien und bewegte Drehpunkte sind geprüft.
- [ ] Pflichtdateien sind vollständig und alle Referenzen auflösbar.
- [ ] Key, Ordner, `sim.cfg`-Titel, Katalog und Manifest stimmen exakt überein.
- [ ] GLTF ist roh und enthält kein `ASOBO_asset_optimized`.
- [ ] GLTF und BIN gehören nachweislich zusammen.
- [ ] Animationsname, Node, XML, GUID, LVar, Zustandswerte und Control stimmen überein.
- [ ] Jede Control-LVar kommt wörtlich in der XML vor.
- [ ] Default-Zustand und Bewegungsrichtung sind dokumentiert.
- [ ] Bei Licht: `ASOBO_advanced_light`, Light-Node und benötigte Außen-/Innenkanäle sind in roher und kompilierter GLTF geprüft.
- [ ] Bei Licht: Emissive und reale Lichtabgabe wurden getrennt für an/aus/an geprüft.
- [ ] Bei Licht: Die ausgelieferte Laufzeit schreibt die deklarierte LVar tatsächlich; Katalogmetadaten allein wurden nicht als Funktionsnachweis gewertet.
- [ ] Syntax- und Publisher-Quellvalidierung sind erfolgreich.
- [ ] SDK-Build, Release und Installation wurden nicht ohne ausdrücklichen Auftrag ausgeführt.
- [ ] Falls beauftragt: DevMode-Sichtprüfung und Live-Steuerung über den echten Homebase-/SimConnect-Pfad wurden getrennt dokumentiert.
