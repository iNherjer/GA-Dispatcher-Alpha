# Flugbuch: Krümelweg und Höhenprofil (Konzept)

Stand: 2026-10-26 · Status: Tracker v593, Worker `/api/flightlog-v1/` und Web-App-Flugbuch mit Lufträumen (Web v2216) umgesetzt

## Ziel

Jeder Flugbucheintrag zeigt in der Web-App den geflogenen Weg auf einer Karte
(zoom- und verschiebbar) und als Höhenprofil mit Gelände. Die Spur ist klein
genug, dass 50 Einträge pro Pilot kaum Speicher und Bandbreite kosten.

## Entscheidungen

| Frage | Entscheidung |
|---|---|
| Wer zeichnet auf? | Nur der Tracker. Der Web-Recorder in `sync.js` wird nicht erweitert (Legacy). |
| Welche Flüge? | Missionen **und** Flüge ohne Mission, jeweils vom Abheben bis zur Landung mit Stillstand. |
| Anzeige | Nur Web-App (Logbuch-Detail). Kein EFB. |
| Anzahl | Missionen max. 50, freie Flüge zusätzlich max. 50, jeweils mit Spur (≈ 100 Spuren, ≈ 300 KB pro Pilot). |
| Filter | Im Flugbuch lassen sich freie Flüge ausblenden. |
| Genauigkeit | ~30 m seitlich, ~50 ft Höhe. Nachjustieren, falls die Last es zulässt. |

## Ist-Stand (Okt 2026)

- Tracker schreibt Rohtelemetrie nur **während eines Missionslaufs** nach
  `flightlogs/<mission>--<run>.jsonl` (~1 Sample/s, ~2 MB pro Flugstunde, nur lokal).
  Quelle: `ga-tracker-client/tracker-flight-log-store.js`, Aufruf in
  `tracker-mission-execution-adapter.js` (`recordSample`).
- Ohne Mission entsteht weder Rohlog noch Logbucheintrag.
- Web-Recorder (`flightRecorder` in `sync.js`) läuft außerhalb des Sim-Modus noch
  mit, legt die Spur aber bewusst nirgends ab (nur kurzlebiger Abschlussdatensatz).
- Logbuch `ga_logbook`: localStorage, max. 50, bereits Quota-Rettungslogik.
  Cloud: eigener gzip-Abschnitt `field:logbook` im Profil (`cloud-sync-core.js`).

## Bausteine

### 1. Freiflug-Aufzeichnung im Tracker

Neuer kleiner Recorder neben dem Missionslauf, nur aktiv, wenn **kein**
Missionslauf aktiv ist (sonst doppelt):

- Start: Flugnachweis (abgehoben, gleiche Kriterien wie Missions-Recorder).
- Ende: Boden + Stillstand (z. B. GS < 2 kt für 20 s) oder Sim-Ende.
- Touch-and-Goes bleiben ein Flug; erst Stillstand beendet ihn.
- Kein Flugnachweis → nichts speichern (Rollen, Repositionieren).
- Ergebnis: Logbucheintrag Typ „Freier Flug" mit Start/Landeplatz
  (nächster Platz), Dauer, Strecke, Max-Höhe, Aufsetz-fpm, Flugzeug.

Die Rohsamples puffert der Recorder im Speicher bzw. nutzt denselben
Flight-Log-Store (eigene `runId` mit Präfix `free-`).

Speicherung getrennt vom Missions-Logbuch, damit dessen Merge-/Quota-Logik
(`_storeMissionLogbookEntries`, `_mergeMissionLogbooks`, Grenze 50) unverändert bleibt:

- lokal eigener Schlüssel `ga_logbook_free` (max. 50, gleiche Quota-Rettung),
- Cloud eigener Profil-Abschnitt `field:freeFlightLog`,
- Eintrag mit `kind: "free"`, eigene `completionId` (`free-<runId>`).

Umgesetzt als `ga-tracker-client/tracker-free-flight-recorder.js`, Ablauf in
`tracker-free-flight-runtime.js`, eingehängt in `tracker.js` (Telemetrie-Takt 500 ms, SimStop,
SimConnect-Close, Prozessende). Nutzt `mission-flight-recorder-core.js` für Start/Statistik, damit
freie Flüge dieselben Werte wie Missionen liefern. Tracker hat keine Flugplatzdaten: Eintrag
trägt `depPosition`/`arrPosition`, die Web-App setzt beim Übernehmen den nächsten Platz ein.
Fertige Flüge warten in `pending` (überlebt Tracker-Neustart) bis die Web-App sie bestätigt.
Verwirft: Rollen ohne Abheben, Missionsstart während des Flugs, Bewegung < 0,3 NM.
Replay der 12 echten Missionslogs: Dauer/Strecke decken sich mit den Missionswerten.

Flugende (Wunsch: Abstellen und „Stecker ziehen" muss den Flug sichern):

| Auslöser | Verhalten |
|---|---|
| 20 s Stillstand nach Landung | Flug abgeschlossen (`landed`) |
| Sim im Hauptmenü (SimStop, 10 s bestätigt) | abgeschlossen (`sim-stopped`); kurze SimStops beim Laden ignoriert |
| MSFS geschlossen/abgestürzt (SimConnect close) | sofort abgeschlossen (`sim-closed`) |
| Tracker beendet (exit, SIGINT/SIGTERM/SIGHUP) | synchron abgeschlossen (`tracker-exit`) |
| Tracker hart beendet | Journal `free-flight-active.jsonl` + Checkpoint; beim nächsten Start: Flug geht weiter, wenn Telemetrie ≤ 3 NM / ≤ 15 min passt, sonst abgeschlossen (`tracker-restart`, spätestens nach 2 min) |

Lokale Ablage (`flightlogs/`): `tracks/<runId>.json` für freie Flüge und Missionen (Missionsspur
entsteht nach `finalize` im Flight-Log-Store, Altbestand per Backfill 30 s nach Start),
je Art max. 50; `free-flight-pending.json` = Postausgang freier Flüge.

### 2. Verdichtung (`flight-track-codec-core.js`, geteilt Tracker/Web)

1. Pausen/Menü-Samples verwerfen, Repositionssprünge als Spurtrennung markieren.
2. 3D-Douglas-Peucker: seitlich 30 m, Höhe 50 ft (Höhe auf Meter umgerechnet,
   Toleranz getrennt geprüft).
3. Pflichtpunkte: erster/letzter Punkt, Abheben, Aufsetzen, höchster Punkt,
   Spurtrennungen.
4. Obergrenze 600 Punkte; darüber Toleranz schrittweise erhöhen.
5. Kodierung als Delta-Varint-Text (Polyline-Prinzip), je Punkt:
   Lat/Lon (1e-5°), Höhe MSL (10 ft), Gelände (10 ft, aus `altFt - aglFt`),
   Zeit seit Start (s).

Umgesetzt in `flight-track-codec-core.js` (Tests: `flight-track-codec-core.test.js`).
Messung mit nachgebautem 1-h-Flug (4930 Samples, 1,1 MB roh): 30 m / 50 ft → 103 Punkte,
1,2 KB; 15 m / 30 ft → 161 Punkte, 1,8 KB. Echte Tracker-Logs (12 Missionsflüge, 2026-09/10, Rohdaten ca. 2 Samples/s, bis 4 MB):
15 m / 30 ft → 16–301 Punkte, 0,2–2,8 KB; 30 m / 50 ft → 12–214 Punkte, 0,2–2,1 KB.
Gemessene Abweichung bleibt innerhalb der Toleranz (Höhe bis +10 ft durch 10-ft-Raster).
Echte Logs prüfen mit
`node tools/flight-track-codec-report.mjs <flightlogs/...jsonl>`.

Format:

```json
{ "v": 1, "tol": [30, 50], "n": 312, "t0": 1761480000000,
  "enc": "<delta-varint-string>", "marks": { "takeoff": 4, "touchdown": 305, "max": 120 } }
```

### 3. Speicher getrennt vom Logbucheintrag

Umgesetzt: Worker `/api/flightlog-v1/` (`tools/cloudflare-worker/flight-logbook.mjs`, eigenes
Durable Object je Pilot, Zuordnung über Speicheranker + Namensraum wie Sync-V2, je Art 50).
Tracker lädt hoch (`tracker-flight-logbook-cloud.js`, alle 10 s, max. 5 je Durchgang, Backoff);
freie Flüge mit vollem Eintrag, Missionen nur Spur + `missionId`/`runId`. Erfolgreich hochgeladene
freie Flüge verlassen den lokalen Postausgang. Korrektur zur ersten Analyse: Sync-V2 überschreibt
fremde Profilfelder nicht (Client behält unbekannte Abschnitte); der eigene Speicher wurde wegen
Bandbreite gewählt (Profilabschnitt würde je Flug komplett neu geladen).

Ursprüngliche Überlegung:

- Logbucheintrag bekommt nur `track: { id: <sha256>, n, bytes }`.
- Spurblob unveränderlich, adressiert über Hash; eigener Bereich im Worker
  (Durable Object des Piloten), nicht im Profil-Abschnitt `field:logbook`.
  Grund: neue Einträge stehen vorne → gzip des ganzen Logbuchs ändert sich
  sonst jedes Mal komplett und würde neu hochgeladen.
- Upload durch den Tracker nach Finalisierung; Wiederholung bei Netzfehler.
- Web lädt die Spur erst beim Öffnen des Eintrags; Cache in IndexedDB
  (nicht localStorage), dauerhaft, da unveränderlich.
- Aufräumen: Spuren ohne Verweis aus dem aktuellen Logbuch löscht der Worker
  beim nächsten Logbuch-Schreiben bzw. per Alarm.

### 4. Anzeige (Web-App, Logbuch-Detail)

Umgesetzt in `flight-logbook-view.js` (nur Web; `flight-debrief.js` bleibt unverändert, weil es
ins EFB kopiert wird). Liste: lokales Missions-Logbuch + freie Flüge aus `/list` (IndexedDB-Cache,
`?since=`), Schalter „Freie Flüge ausblenden/zeigen“ (`ga_logbook_show_free`). Start/Landung freier
Flüge: Flugplatz im Umkreis 3 NM, sonst Koordinaten. Missionseinträge finden ihre Spur über `runId`,
ältere über `missionId` + Endzeit ±15 min. Bericht: Abschnitt „Flugweg“ mit OpenTopoMap-Karte
(Linie nach Höhe gefärbt, Start/Ende/Aufsetzen) und SVG-Höhenprofil mit Gelände, gekoppeltem Cursor
und Werten (Höhe, über Grund, GS, Strecke, Uhrzeit). Freie Flüge ohne Passagier-/Ladungsabschnitt.
„Leeren“ löscht auch das Cloud-Flugbuch.

Lufträume (Web v2216): Karte mit denselben Grundkarten/Overlays wie die Hauptkarte (Topo gedimmt unter
VFR-Overlay, Overlay ab Zoom 15 aus, DFS ICAO, Satellit, OpenFreeMap), Auswahl gemerkt
(`ga_logbook_map_layers_v1`). Lufträume über `gaGetOpenAipRouteAirspaces` (Bounding Box der Spur),
aufbereitet und bewertet mit `navigation-warning-core.js` (`prepareAirspaces`,
`getAirspaceVerticalBandFt`, `isPointInsideAirspace`) – dieselben Regeln wie die Luftraumwarnung.
Prüfung alle ~0,1 NM mit interpolierter Höhe/Gelände: „durchflogen“ = seitlich und vertikal innen,
sonst „unter-/überflogen“. Profil zeigt die Bänder (AGL-Grenzen folgen dem Gelände), Liste mit
Grenzen, Ein-/Austrittszeit und Dauer. Grenze: Luftraumdaten von heute, nicht vom Flugzeitpunkt;
Aktivierungszeiten (ED-R, NOTAM) nicht ausgewertet.

Einzelne Einträge löschen (Web v2218): Knopf „Eintrag löschen“ im Flugbericht (nur aus dem Flugbuch
geöffnet). Freie Flüge: `delete {runIds}` im Worker. Missionseinträge: Löschvermerk
`{schemaVersion: 2, completionId, deleted: true, deletedAt}` im Logbuch; `_mergeMissionLogbooks`, der
Abschluss-Upload und `_upsertMissionLogbook` lassen den Vermerk gewinnen, damit andere Geräte oder
ein erneut eintreffender Abschluss den Eintrag nicht zurückbringen; zugehörige Spur wird mitgelöscht.
Linienfarbe einstellbar (Web v2219, `ga_logbook_track_color_v1`), gilt für Karte und Profillinie:
Höhe (tiefster bis höchster Punkt), Geschwindigkeit (0 bis 95. Perzentil GS), Steig-/Sinkrate
(symmetrisch ±95. Perzentil, mind. ±300 ft/min, grau unter 100 ft/min). Werte je Spurabschnitt
(mittlere Höhe, Strecke/Zeit, Höhendifferenz/Zeit). Legende mit Skala unter der Karte.

Missionsergebnis und PDF (Web v2221): Abschnitt „Missionsergebnis“ aus dem Logbucheintrag (Ergebnis,
Grund aus Ladungsergebnis, geplantes vs. tatsächliches Ziel, Pflichtladung/Zustand, SAR-Zusammenfassung,
Passagier = Komfort-Stimmung + Wert, Sterne = Wert/20). PDF (`board.js` ruft
`GAFlightLogbook.preparePdf`): Seite 2 mit Karte (OpenTopoMap-Kacheln, Lufträume, Spur in gewählter
Färbung), Farblegende, Höhenprofil (SVG als Bild), Luftraumliste, Missionsergebnis. Abschiedsworte (Tracker v594 / Web v2222): `tracker-mission-farewell-voice.js` meldet den tatsächlich
erzeugten Text (`onSpoken`); `tracker.js` legt ihn als Notiz `tracks/<runId>.note.json` ab
(`putNote`, max. 2000 Zeichen, ~0,3–0,5 KB). Der Upload schickt `farewellText`/`farewellSpeaker`/
`farewellRole` im Missionseintrag des Flugbuch-Speichers mit; kommt die Notiz nach dem Upload, wird
der Eintrag erneut hochgeladen. Kein Eintrag im Profil-Logbuch, kein Browser-Speicher. Web zeigt das
Zitat im Missionsergebnis und im PDF. Ältere Flüge haben keine Abschiedsworte.

- Karte: Leaflet-Linie nach Höhe eingefärbt, Marker Start/Landung,
  `fitBounds` beim Öffnen, frei zoom-/verschiebbar.
- Höhenprofil: SVG, x = Strecke (umschaltbar Zeit), y = Höhe MSL,
  Gelände als gefüllte Fläche. Bestehenden `vpProfile`-Code prüfen/wiederverwenden.
- Kopplung: Hover im Profil ↔ Marker auf Karte, Tooltip mit Höhe, AGL, GS, Uhrzeit.
- Einträge ohne Spur (alt) zeigen nur die bisherigen Daten.
- Flugbuchliste zeigt Missionen und freie Flüge gemeinsam nach Datum sortiert;
  freie Flüge sind gekennzeichnet. Schalter „Freie Flüge anzeigen" (Standard: an),
  gemerkt pro Gerät in localStorage (`ga_logbook_show_free`), mit try/catch.

### Altbestand (Nachrüsten)

- Missionsflüge: Rohlog `flightlogs/<missionId>--<runId>.jsonl` und Logbucheintrag
  (`completionId = <missionId>-<endedAt>`, neuere Einträge mit `runId`) lassen sich zuordnen.
  Der Tracker erzeugt einmalig für alle vorhandenen Rohlogs die Spur; die Web-App hängt sie
  an passende Einträge. Einträge ohne Rohlog bleiben ohne Spur.
- Freie Flüge vor Einführung des Recorders: keine Rohdaten vorhanden, daher nicht nachrüstbar.

## Offene Punkte

- Worker-Endpunkt und Speicherlimit pro Pilot festlegen.
- Tracker-Änderung → EXE-Release nötig (nur nach Freigabe).


## Missionseinträge schreibt der Tracker (Tracker v595 / Web v2225)

Nutzerentscheidung 27.10.2026: Fliegen ohne Web-App muss vollständige Flugbucheinträge ergeben.
Der Tracker baut bei Abschluss/Abbruch eines Laufs den Eintrag mit `mission-logbook-record-core.js`
(gleiches Schema und gleiche `completionId` wie bisher die App), Postausgang im Authority-Kern,
Ablage `tracks/<runId>.entry.json`, Upload mit Spur und Abschiedsworten (`hasLogbookRecord: true`).
Ohne Spur geht der Eintrag nach 10 min allein hoch. Abgebrochene Läufe nur mit Flugdaten,
`result: 'aborted'`. Die Web-App liest Missionen aus der Cloud, aktualisiert beim Öffnen des
Flugbuchs, zeigt ältere Profil-Einträge ohne Cloud-Gegenstück weiter und schreibt bei
`flight.logbook.v1` keine eigenen Missionseinträge mehr. Alte Läufe werden nicht nachgerüstet.
