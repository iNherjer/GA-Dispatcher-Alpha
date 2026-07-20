# PC-Handoff: instanzlokale Homebase-Hangartore

Stand: 20.07.2026

## Ziel

Das Tor jedes platzierten Hangars soll einzeln steuerbar sein. Das gilt fuer den Haupt-Hangar, als Dekoration platzierte Hangars, die Live-Vorschau und den kompilierten Flugplatz. Die automatische Steuerung oeffnet pro Instanz bei hoechstens 36 m und schliesst pro Instanz ab 40 m nach drei Sekunden. Flugzeug und Walkaround-Position gelten beide als Naehequelle. Die Automatik ist in der Workbench global abschaltbar; manuelle Einzelbefehle bleiben verfuegbar.

Es werden keine Modellkopien, nummerierten LVars oder zehn XML-Dateien fuer zehn Hangars benoetigt. Eine gemeinsame Modell-XML verwendet eine objektlokale Variable. SimConnect schreibt denselben Variablennamen an die konkrete SimObject-ID.

## Wichtig vor dem Merge

Auf dem PC wurden am Publisher bereits weitere Fixes vorgenommen. Deshalb den OneDrive-Ordner nicht komplett ueber die PC-Arbeitskopie kopieren. Zuerst die unten genannten Dateien vergleichen und die Aenderungen semantisch in den aktuellen PC-Stand uebernehmen. Vorhandene PC-Fixes bleiben erhalten.

Wenn der PC-Katalog bereits eine hoehere Paket- oder Assetversion als die hier genannten Werte besitzt, nicht herunterstufen. Dann die jeweils naechste freie Version verwenden.

## Publisher-Aenderungen

### 1. Lokale Variablen im Katalog zulassen

Datei: `asset-visibility-policy.js`

- `control.scope` normalisieren; erlaubte Werte: `global`, `simobject`.
- Bei `global` weiterhin `L:VFR_HOMEBASE_...` akzeptieren.
- Bei `simobject` `L:1:VFR_HOMEBASE_...` und optional `Z:VFR_HOMEBASE_...` akzeptieren.
- Den normalisierten `scope` im Ergebnis unter `animation.control.scope` erhalten.

Zielkonfiguration des Rundhangartors:

```json
{
  "transport": "simconnect-lvar",
  "simvar": "L:1:VFR_HOMEBASE_ROUND_HANGAR_DOOR_COMMAND",
  "unit": "number",
  "scope": "simobject",
  "values": { "open": 0, "closed": 1 }
}
```

### 2. Scope im Publisher-Formular bearbeiten

Dateien: `web/index.html`, `web/app.js`

- Im Animationsbereich ein Auswahlfeld fuer den Steuerungsbereich anbieten:
  - `Global fuer alle Modellkopien`
  - `Einzelnes SimObject`
- Beim Laden eines bestehenden Assets `animation.control.scope` in das Feld uebernehmen.
- Beim Speichern den gewaehlten Wert als `animation.control.scope` mitsenden.
- Die Hilfe soll erklaeren, dass `L:1:` oder `Z:` fuer Instanzsteuerung und `L:` fuer globale Steuerung gedacht ist.

### 3. Modell-XML umstellen

Diese beiden Rohquellen muessen dieselbe Aenderung enthalten:

- `Homebase-Asset-Publisher-Data/source/SimObjects/Misc/VFRHomebaseRoundHangar/model/HomebaseRoundHangar.xml`
- `seed/PackageSources/SimObjects/Misc/VFRHomebaseRoundHangar/model/HomebaseRoundHangar.xml`

Im `ANIM_CODE` des Tores:

```xml
(L:1:VFR_HOMEBASE_ROUND_HANGAR_DOOR_COMMAND, Number)
```

Der alte globale Ausdruck `(L:VFR_HOMEBASE_ROUND_HANGAR_DOOR_COMMAND, Number)` darf fuer das Tor nicht mehr vorkommen. Die globale Innenbeleuchtung bleibt unveraendert.

### 4. Kataloge und Versionen

Dateien:

- `Homebase-Asset-Publisher-Data/catalog.json`
- `seed/catalog.json`

Im vorbereiteten Mac-Stand sind vorgesehen:

- Paketversion `0.6.6`
- Rundhangar-Version `1.0.2`
- Torvariable `L:1:VFR_HOMEBASE_ROUND_HANGAR_DOOR_COMMAND`
- Scope `simobject`

Bei bereits hoeherem PC-Stand die Versionsnummern entsprechend weiter erhoehen. Katalog, Arbeitsdaten und Seed muessen am Ende dieselben Werte enthalten.

### 5. Weitere angepasste Publisher-Dateien

- `publisher-core.mjs`: Validierungs-/Fehlermeldung nennt globale und objektlokale LVars.
- `publisher-self-test.mjs`: Rundhangar erwartet `L:1:VFR_HOMEBASE_ROUND_HANGAR_DOOR_COMMAND` mit `scope: simobject`.
- `sim.cfg` in Arbeitsdaten und Seed: Beschreibung auf instanzlokale Torsteuerung aktualisiert.
- `README.md`: Abschnitt `Instanzlokale Hangartore`.

## Windows-Build

1. Den gesamten Publisher-Ordner in OneDrive zuerst vollstaendig lokal herunterladen (`Immer auf diesem Geraet behalten`). Zero-Byte-GLTF-Dateien fuehren sonst zu `Unexpected end of JSON`.
2. Publisher-Selbsttest ausfuehren.
3. SDK-Projekt neu vorbereiten.
4. Mit dem offiziellen MSFS-2024-SDK kompilieren.
5. Sicherstellen, dass der Build Paketversion `0.6.6` oder die auf dem PC gewaehlte hoehere Version traegt.
6. Das neue Assetpaket im aktiven Community-Ordner installieren.
7. MSFS vollstaendig neu starten.

Blender ist fuer diese Aenderung nicht erforderlich. Die Geometrie, Animation und Animation-ID bleiben identisch; nur die von der XML gelesene Steuervariable wird objektlokal.

## Laufzeitdateien

### Normaler integrierter Test

Nur diese Komponenten verwenden:

1. `VFR-Multitool-Tracker.exe` aus `Integrated-Tracker-v299-Instance-Doors` starten.
2. VFR-Multitool-Haupt-App starten und verbinden.
3. Homebase-Workbench oeffnen.

Der Tracker v299 enthaelt Vorschau-Spawning, Objektverwaltung, manuelle Einzelsteuerung und die Automatik bereits in einem Prozess. Der separate Preview-Stabilizer wird dabei nicht gestartet und nicht benoetigt.

### Separate Tuer-Test-EXE

`VFR-Multitool-Homebase-Door-Test.exe` ist ein unabhaengiger SimConnect-Testclient. Er darf parallel zum Tracker laufen, erzeugt aber keine Hangars und ist nicht mit der Workbench-Checkbox verbunden. Er dient nur dazu, Erkennung, Walkaround-Position und 36/40-m-Logik isoliert zu testen.

Fuer den abschliessenden Test der integrierten Checkbox die Tuer-Test-EXE wieder beenden. Sonst kann sie weiter automatische Torbefehle senden, obwohl die Automatik im Tracker ausgeschaltet wurde.

### Preview-Stabilizer

`VFR-Multitool-Homebase-Preview-Stabilizer.exe` gehoert zum historischen Standalone-/Legacy-Workbench-Paket. Der alte Supervisor `Start-VFR-Multitool-Homebase.bat` startet ihn automatisch zusammen mit Legacy-Tracker und Workbench-Server. Ein einzeln gestarteter produktiver Tracker startet ihn nicht.

Version `0.3.15` beherrscht ebenfalls die instanzlokale Torsteuerung und wird nur benoetigt, falls der alte Standalone-Testaufbau weiterhin getestet wird.

## In-Sim-Abnahmetest

1. Zwei Rundhangars desselben Assets mit mindestens etwa 50 m Abstand platzieren; einer darf ein Deko-Hangar sein.
2. In der Workbench pruefen, dass fuer beide Hangars je eine eigene Karte `Rundhangar Tor` erscheint.
3. Hangar A manuell schliessen und oeffnen; Hangar B darf sich nicht bewegen.
4. Dasselbe mit Hangar B wiederholen.
5. Automatik einschalten und sich nur Hangar A bis auf 36 m naehern; nur A muss oeffnen.
6. Mindestens 40 m von A entfernen und drei Sekunden warten; A muss schliessen.
7. Den Test im Walkaround wiederholen.
8. Automatik in der Workbench ausschalten; danach darf keine automatische Bewegung mehr erfolgen.
9. Tracker neu starten; die Workbench muss den gespeicherten Schalter nach dem neuen Tracker-Hello erneut uebertragen.
10. Dieselben Punkte zuerst mit der Live-Vorschau und danach mit dem kompilierten Platz pruefen.

## Erwartete Diagnose

- Manuell nur eine Instanz bewegt: Object-ID-Adressierung funktioniert.
- Live-Vorschau funktioniert, kompilierter Platz nicht: installiertes Assetpaket liest noch die alte globale `L:`-Variable oder MSFS hat das neue Paket noch nicht neu geladen.
- Beide Hangars bewegen sich gemeinsam: alte XML beziehungsweise alter kompilierter Build ist aktiv.
- Automatik funktioniert, Checkbox-Aus nicht: separate Tuer-Test-EXE laeuft noch.
- Publisher meldet JSON-/GLTF-Fehler: OneDrive-Quelldateien sind noch nicht vollstaendig lokal verfuegbar.
