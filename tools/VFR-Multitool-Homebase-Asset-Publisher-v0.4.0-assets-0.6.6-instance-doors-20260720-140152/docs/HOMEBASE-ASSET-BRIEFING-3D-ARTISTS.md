# Homebase-Modelle: Übergabe-Briefing für 3D-Artists

Stand: 17.07.2026

Dieses Briefing beschreibt, was wir von externen oder internen 3D-Artists benötigen. Es setzt keine Kenntnisse unserer Publisher-Anwendung voraus.

## Was wir pro Modell brauchen

Bitte liefere:

- die bearbeitbare Blender-Datei;
- das Modell in realen Metermaßen;
- eine unkompilierte GLTF mit zugehöriger BIN-Datei;
- alle verwendeten Texturen;
- eine kurze Notiz zu Abmessungen, Vorderseite, Bodenpunkt und beweglichen Teilen;
- bei Animationen eine Tabelle mit Animationsname, bewegtem Node/Bone, Anfang, Ende, Dauer und Standardzustand.

Wir übernehmen daraus die endgültige MSFS-Paketstruktur und ordnen die Lieferung unter `asset-library/<SimObject-Ordner>` ein. Bitte liefere kein bereits vom MSFS-SDK kompiliertes Modell als Masterquelle.

## Szenenaufbau in Blender

- Einheit: Meter, `1 Blender Unit = 1 Meter`.
- Modell in plausibler Originalgröße anlegen.
- Ursprung bei normalen Bodenobjekten mittig auf der Aufstandsfläche setzen.
- Vorderseite eindeutig kennzeichnen oder dokumentieren.
- Keine unbeabsichtigte Verschiebung, Drehung, negative Skalierung oder nicht uniforme Skalierung am fertigen Modell hinterlassen.
- Bewegliche Teile als eigene, klar benannte Objekte oder Bones anlegen.
- Drehpunkte dort setzen, wo sich das reale Teil bewegt: Türangel, Schiebetorführung, Klappenachse usw.
- Objekte, Materialien, Bones und Animationen eindeutig und möglichst englisch benennen. Keine Namen wie `Cube.017` für wichtige Funktionsteile.
- Texturen relativ zum Projekt halten und vollständig mitliefern. Keine Abhängigkeit von persönlichen Laufwerkspfaden.

## Animationen

Bitte vor dem Animieren mit uns festlegen:

| Angabe | Beispiel |
|---|---|
| Funktion | Hangartor öffnen/schließen |
| Animationsname | `RoundHangarDoor` |
| bewegter Node/Bone | `RoundHangarDoor` |
| Anfang | offen |
| Ende | geschlossen |
| Standardzustand | offen |
| gewünschte Dauer | 5 Sekunden |
| Animationsbereich | 0 bis 100 |

Der Name der Blender-Animation und der Name des bewegten Nodes müssen beim GLTF-Export erhalten bleiben. Diese Namen werden später exakt in unserer MSFS-Modell-XML verwendet. Nach einer ersten Integration bitte nicht mehr ohne Rücksprache umbenennen.

Für einfache Schalteranimationen verwenden wir normalerweise:

- Zustand A am Anfang des Clips;
- Zustand B am Ende des Clips;
- einen normalisierten MSFS-Animationsbereich von `0..100`;
- eine weiche, realistische Bewegung ohne Sprung;
- keine Bewegung des gesamten Modells, sofern diese nicht ausdrücklich gewünscht ist.

Eine Animation in der GLTF allein ist noch nicht steuerbar. Wir verbinden sie zusätzlich über die MSFS-Modell-XML mit einer Homebase-Steuervariable. Dafür brauchen wir von euch vor allem stabile Animations- und Node-Namen sowie eine eindeutige Beschreibung der Bewegungsrichtung.

## Lichter und Emissive-Flächen

Bei schaltbaren Lichtern bitte getrennt und eindeutig benennen:

- sichtbare Lampe beziehungsweise Emissive-Fläche;
- echtes Lichtobjekt;
- betroffene Nodes;
- gewünschte Lichtfarbe, Helligkeit, Richtung und Reichweite;
- gewünschter Standardzustand.

Emissive-Fläche und tatsächliches Licht sollen gemeinsam schalten. Falls der verwendete MSFS-Exporter spezielle Light-Extensions erzeugt, müssen diese in der unkompilierten GLTF erhalten bleiben.

Für MSFS benötigen wir bei einem echten Licht außerdem:

- einen eindeutig benannten, exportierten Light-Node;
- dokumentierte Farbe, Intensität, Richtung, Kegelwinkel und Reichweite;
- die Information, ob das Licht außen, innen oder in beiden Bereichen wirken soll;
- bei frei platzierten Objekten grundsätzlich einen aktivierten Außenkanal, sofern wir nicht ausdrücklich etwas anderes vereinbaren;
- eine erhaltene `ASOBO_advanced_light`-Extension oder einen dokumentierten Nachbearbeitungsschritt, der sie nach dem Blender-Export ergänzt.

Bitte die Emissive-Fläche und die tatsächliche Beleuchtung der Umgebung getrennt kontrollieren. Eine sichtbar helle Lampenfläche bedeutet nicht automatisch, dass MSFS auch echtes Licht abstrahlt. Das endgültige Schalten über unsere Homebase-Steuerung wird anschließend von uns im Simulator geprüft.

## Materialien und Geometrie

- Normalen und harte Kanten sichtbar prüfen.
- UVs und Texturmaßstab plausibel halten.
- Transparenz nur dort verwenden, wo sie benötigt wird, und den Alpha-Modus dokumentieren.
- Rückseiten vermeiden, wenn eine Fläche von beiden Seiten sichtbar sein muss.
- Polygonzahl und Texturauflösung angemessen halten; viele Homebase-Objekte können gleichzeitig sichtbar sein.
- Unsichtbare Hilfsobjekte, Referenzbilder und nicht benötigte Testgeometrie nicht mit exportieren.
- Falls ein separates Kollisionsmodell beauftragt ist, dieses als einfache, zusammenhängende und klar benannte Geometrie liefern; sichtbares Modell und Kollision nicht ungefragt vermischen.

## Dateinamen und Übergabe

Bevorzugtes Schema:

```text
HomebaseExample.blend
HomebaseExample_LOD00.gltf
HomebaseExample_LOD00.bin
textures/
  ...
README-ARTIST.txt
```

GLTF und BIN gehören immer zusammen und müssen aus demselben Export stammen. Werden Geometrie oder Animation geändert, bitte beide Dateien neu liefern. Alte und neue Dateien nicht im selben Übergabeordner mischen.

In der Begleitnotiz bitte angeben:

- Modellname und Änderungsdatum;
- Blender- und Exporterversion;
- Maße Breite × Tiefe × Höhe;
- Position des Ursprungs und definierte Vorderseite;
- Material- und Texturliste;
- Animationsliste mit Zuständen und Dauer;
- bekannte Einschränkungen oder noch offene Punkte.

## Artist-Selbstprüfung vor Abgabe

- [ ] Maße sind korrekt und in Metern.
- [ ] Ursprung und Bodenlage sind korrekt.
- [ ] Vorderseite ist dokumentiert.
- [ ] Transformationen und Drehpunkte sind geprüft.
- [ ] Normalen, Materialien, UVs und Texturen sehen korrekt aus.
- [ ] Keine fehlenden Texturen oder absoluten Dateipfade.
- [ ] Nur benötigte Objekte werden exportiert.
- [ ] Jede Animation hat einen eindeutigen stabilen Namen.
- [ ] Bewegte Nodes/Bones sind eindeutig benannt und exportiert.
- [ ] Anfang, Ende, Standardzustand und Dauer jeder Animation sind dokumentiert.
- [ ] GLTF und BIN stammen aus demselben finalen Export.
- [ ] Die gelieferten Dateien sind Rohquellen und nicht bereits SDK-kompiliert.
