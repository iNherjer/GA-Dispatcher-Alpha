# Vereinsflotte über „Where I Left It“

Stand: 02.11.2026 · Status: Abgleich, Belegung, Push und Crew-Brett gebaut (Desktop 1.6.32, Tracker v606 Alpha, Web v2305)

Ziel: Abgestellte Maschinen aus dem MSFS-2024-Mod „Where I Left It“ (Yetty,
flightsim.to/addon/116765, v2.0.0) mit der Crew teilen. Die Crew sieht die
Vereinsmaschinen auf dem Crew-Brett (Zettel + Karte) und kann sie selbst fliegen
(Haltergemeinschaft). Die neue Position kommt nach dem Abgleich beim Halter an.

## 1. Dateien des Mods

Ordner `work`:

- Store: `%LOCALAPPDATA%\Packages\Microsoft.Limitless_8wekyb3d8bbwe\LocalState\WASM\MSFS2024\community-whereileftit\work`
- Steam: `%APPDATA%\Microsoft Flight Simulator 2024\WASM\MSFS2024\community-whereileftit\work`

Alle Zeilen sind `|`-getrennt, Schlüssel und JSON URL-kodiert.

Schlüssel einer Maschine: `tail:<Kennzeichen>|<Sim-Titel>`. Jede Titel-Variante
(z. B. „A2A Lancair Legacy“ und „LEGACY ANALOG GTN750XI“) ist eine eigene Maschine.

### `state.txt`: Spawn-Liste für das Sim-Modul

```
settings|ask|tail|1|25||10|5
rec|<key>|title|livery|tail|lat|lon|altFt|aglFt|hdgTrue|pitch|bank|onGround(1/0)|hidden(1/0)
```

- Abgeleitet aus dem EFB-Speicher, kein `savedAt`, kein Sprit, keine Zuladung.
- **Nicht beschreiben.** Das EFB schreibt die Datei aus seinem eigenen Speicher neu.
- Gut zum **Lesen**: Eine geänderte `rec`-Zeile zeigt, dass eine Maschine bewegt wurde.

### `journal.txt`: Flugbuch-Zuwächse vom Modul an das EFB

```
seq|21
p
d|<key>|flightSecs|engineSecs|distanceNm|landings|timestampMs
```

### `backup.txt`: Export und Import (gleiche Datei)

```
WHEREILEFTIT-BACKUP|1|2.0.0|<exportMs>
pos|<key>|{name,title,livery,liveryName,tail,lat,lon,altFt,aglFt,hdgTrue,pitch,bank,
           onGround,hidden,savedAt,tag?,customName?,fuel:[[Tank,Gal]],payload:[lbs je Station]}
log|<key>|{flightSecs,engineSecs,landings,lastFlown,distanceNm,notes,
           flights:[{start,end,from,fromLat,fromLon,to,toLat,toLon,secs,nm,landings,open}],
           flightsOffset}
```

„Export Backup“ schreibt `backup.txt`. „Import Backup“ liest dieselbe Datei und führt sie zusammen.

## 2. Import-Verhalten (getestet am 02.11.2026 mit der Testmaschine TEST1)

| Test | Inhalt | Meldung | Ergebnis |
|---|---|---|---|
| 1 | neue Maschine | 1 new, 1 logbook | Maschine angelegt und gespawnt |
| 2 | älterer `savedAt`, andere Position | 0 updated, 1 logbook | Position bleibt, Flug BBBB im Flugbuch ergänzt |
| 3 | neuerer `savedAt`, andere Position | 1 updated, 1 logbook | Position, Kurs und Name übernommen, Flug CCCC ergänzt |

Regeln, die sich daraus ergeben:

- **`pos`: Ganzer Datensatz, neuer gewinnt (`savedAt`).** Name, Tag, Sprit und Zuladung
  kommen mit. Beim Import bleibt der `savedAt` aus der Datei erhalten.
- **Nichts wird gelöscht.** Lokale Maschinen, die in der Datei fehlen, bleiben.
- **`log.flights`: Vereinigung, ohne Doppelte, nach Start sortiert.** Ein mehrfacher
  Import derselben Datei verdoppelt keine Flüge.
- **`log`-Summen** (flightSecs, engineSecs, landings): Bei älterem Stand bleiben sie,
  bei neuerem werden sie übernommen. Ob die Regel „neuer `lastFlown` gewinnt“ oder
  „Maximum“ lautet, ist noch offen. Die Summen werden nicht aus `flights` neu berechnet.
- **`log.notes`: Der lokale Text bleibt.** Notiz C wurde nicht übernommen.
- **Fehlender Sim-Titel:** Die Maschine erscheint im Hangar, ist aber nicht fliegbar.
  Der Mod stürzt nicht ab.

Folge: Wir können `pos` **und** `log` über die Cloud teilen. Die Flüge können nicht
doppelt werden. Die Summen bleiben nur stimmig, wenn vor jedem Flug der aktuelle
Stand importiert wird. Dafür sorgt die Ausleih-Sperre.

## 3. Umgesetzt (02.11.2026)

Abweichend von Ausbaustufe 1 läuft der Abgleich gleich über `backup.txt` in beide
Richtungen, wie vom User gewünscht. Nicht im Tracker-Kern (`tracker.js`), sondern in
der Desktop-App, damit er auch ohne laufende Engine funktioniert.

| Teil | Datei |
|---|---|
| Gemeinsame Regeln (Format, Zusammenführen) | `wili-fleet-core.js` (Repo-Wurzel) |
| Worker, DO `CrewFleet` je Crew | `tools/cloudflare-worker/crew-fleet.mjs` (+ Test) |
| Desktop-Abgleich | `ga-tracker-client/desktop/lib/wili-fleet-sync.js` (+ Test) |
| Desktop-Modul „Vereinsflotte“ | `ui/index.html`, `ui/renderer.js`, `ui/styles.css`, `main.js`, `preload.js` |

Ablauf:

- Modul unten in der Desktop-App, standardmäßig aus. Links zur flightsim.to-Seite
  und zum Mod-Ordner.
- **Autosync an:** Ändert sich `backup.txt` (Mod-Export), lädt die App nur die geänderten
  Maschinen hoch. Maschinen, die die Cloud schon gleich oder neuer hat, gehen nicht hoch.
  Danach und alle 10 min (Tracker läuft) bzw. 60 min (sonst) fragt sie die Cloud mit
  `?since=<rev>`. Antwort `unchanged` = ein kleiner Request, kein Speicherzugriff auf
  Maschinen.
- **Autosync aus:** Knöpfe „Backup hochladen“ und „Crew-Stand laden“, sonst kein Netzverkehr.
- Neue Crew-Stände werden mit den Mod-Regeln in `backup.txt` gemischt (Kopie vorher in
  `Dokumente/VFR Multitool/Tracker/wili-backups`, die letzten 5). Hinweis „N Maschinen
  bereit zum Import“, bis `state.txt` die neuen Positionen zeigt.
- Exportiert der Pilot vor dem Import, überschreibt der Mod die vorbereitete Datei. Die
  App kennt den Crew-Stand lokal (`wili-fleet-sync.json`) und mischt ihn beim nächsten
  Abgleich wieder ein.
- Crew-Name aus dem Cloud-Profil (`field:groupName`), höchstens alle 6 h, bei 403 sofort neu.
- Worker: Anmeldung und Mitgliedschaft je Isolate 30 min zwischengespeichert, keine
  KV-Schreibzugriffe, Schreiben nur bei echter Änderung (kanonischer Vergleich).

### Belegung (Ausbau 02.11.2026)

Regeln in `wili-fleet-core.js` (`applyLock`, `activeLock`), Server in `crew-fleet.mjs`:

| Zustand | Ausgelöst durch | Endet |
|---|---|---|
| Reserviert | „Reservieren“ auf dem Crew-Brett | 12 h, „Freigeben“, oder Start → In der Luft |
| In der Luft | Tracker meldet `takeoff` mit dieser Maschine | 12 h, „Freigeben“, oder `parked` → Gelandet |
| Gelandet | Tracker meldet `parked` (60 s Stillstand nach Landung) | 12 h, „Freigeben“, oder nächster Upload (Mod-Export) dieses Piloten → Frei |

- Jeder Zustand sperrt die Maschine für alle anderen: keine Reservierung, Uploads werden abgelehnt
  (`blocked`), ein Start wird als Konflikt am Datensatz vermerkt (`conflict`, Crew-Brett zeigt „⚠️ auch von X
  geflogen – zählt nicht“).
- Desktop: gesperrte Maschinen nicht hochladen; weicht die lokale Kopie ab, wird der Stand des Belegenden mit
  `savedAt` knapp über dem lokalen geschrieben (Mod übernimmt ihn). In der Luft/Gelandet bei jemand anderem:
  `hidden: true` (Test 02.11.2026: Mod blendet die Maschine aus), danach wieder sichtbar am neuen Platz.
  Von der App ausgeblendete Kopien gehen nie hoch (`ledger.hidden`).
- Maschine erkennen (`matchAircraft`): Kennzeichen + Titel, sonst eindeutiges Kennzeichen, sonst Titel innerhalb
  1 km vom Abstellplatz vor dem Start. Tracker liest `TITLE` und `ATC ID` (`tracker-aircraft-identity.js`).

### Sofort-Abgleich und Crew-Brett

- Desktop hält eine ruhende WebSocket-Verbindung (`/api/crew-fleet-v1/<Crew>/ws`, Hibernation, „ping“ je Minute
  ohne das DO zu wecken). Jede Änderung schickt `{ type: 'fleet', rev }`; Autosync gleicht dann sofort ab,
  manueller Modus zeigt „N Maschine(n) neu“. Rückfall-Abfrage stündlich (ohne Verbindung 10 min bei laufendem
  Tracker). Abgleich beim Start der EXE (manuell: nur nachsehen).
- Crew-Brett (`crew-fleet-client.js`): Zettel „🛩️ Vereinsflotte“ mit Status, Ort (nächster Platz), Reservieren/
  Freigeben, Karte. Kein eigenes Polling: Der Crew-Status-Abruf (3 min) liefert `fleetRev`, die Flotte lädt nur bei
  Änderung, beim Öffnen (höchstens alle 30 s, sonst `unchanged`) und mit 🔄.
- Schalter „🛩️ Vereinsflotte“ unter „Meine Freigaben“ (`crewShare.fleet`, Standard an): aus = kein Zettel, keine
  Abrufe, keine Tracker-Meldungen.
- Live-Flug-Zettel zeigen die Maschine (`flight.aircraft`).

### Hinweis bei Änderungen (Tracker v607, Web v2306)

- Ändert ein anderer Pilot die Flotte (reserviert, in der Luft, gelandet, wieder frei, neuer Standort, neue
  Maschine, Konflikt), erscheint „🛩️ Vereinsflotte geändert: … Bitte aktualisieren.“ – 30 s, mit × schließbar.
  Eigene Änderungen nie (`changeNotes`/`noticeText` in `wili-fleet-core.js`).
- EFB: `tracker-crew-fleet-watch.js` hält eine ruhende WebSocket-Verbindung zur Flotte (wie die Desktop-App),
  lädt bei jeder Änderung nur das Geänderte und legt den Hinweis in den Tracker-Status (`crewFleetNotice`), den das
  EFB jede Sekunde abfragt. Anzeige im Kartentisch-Host (`gaFleetNotice`).
- App: `crew-fleet-client.js` vergleicht beim Laden über den Crew-Status-Abruf (alle 3 min, solange sichtbar);
  Band oben mit „Pinnwand“ (öffnet das Crew-Brett) und ×.

Noch nicht gebaut: Löschvermerk (Maschine aus der Flotte nehmen).

Bekannt: Das Kennzeichen-Decal fehlt an vom Mod gespawnten Maschinen in MSFS 2024 (Grenze des Mods/Sims laut
Mod-Seite); User testet weiter.

Bekannte Grenze: Zwei Crew-Mitglieder mit gleichem Kennzeichen und gleichem Sim-Titel
(z. B. Standardlackierung) teilen sich für den Mod dieselbe Maschine.

## 4. Architektur (Zielbild)

### Cloud: Durable Object `CrewFleet` je Crew (wie `CrewPresence`)

- **Kein `GROUP_`-KV-Eintrag.** Schreiben nur bei Änderungen.
- Ein Datensatz je Mod-Schlüssel:
  - `pos`, `log` (Rohdaten des Mods)
  - `ownerPilotId`, `shared` (vom Halter freigegeben)
  - `version` (Zähler vom Server), `serverUpdatedAt`, `lastPilotId`
  - `lock {pilotId, since, expiresAt}`
  - `deleted` (Löschvermerk)
- Zusammenführen je Maschine, nie die ganze Datei. Der Upload enthält die Version,
  auf der der Pilot aufbaut.
  - Ist die Version veraltet und hält ein anderer die Sperre, wird der Upload abgelehnt.
  - Ohne Sperre gewinnt der Halter.
- Endpunkte (vorläufig):
  - `GET /api/crew-fleet-v1/<Crew>`
  - `POST …/upsert`
  - `POST …/lock`
  - `POST …/release`
  - `POST …/remove`

### Tracker

1. **Lesen:** Der Tracker beobachtet `state.txt` (Dateiänderung) und `journal.txt`.
   - Ändert sich eine `rec`-Zeile einer freigegebenen Maschine, lädt er die Position hoch.
   - Liegt eine neuere `backup.txt` vom Mod-Export vor, nimmt er den vollen
     Datensatz daraus (Sprit, Zuladung, Flugbuch).
2. **Importdatei bauen:** In die Datei kommen Crew-Maschinen, deren Server-Version
   neuer ist als die zuletzt hier übernommene.
   - **Uhrzeit-Schutz:** `savedAt` in der Datei = max(Cloud-`savedAt`, lokaler `savedAt` + 1).
     So entscheidet die Server-Version und nicht die PC-Uhr, und der Mod übernimmt den Stand.
   - **Vorhandene `backup.txt` nie stillschweigend überschreiben.** Vorher eine Kopie
     `backup-<Zeit>.txt` anlegen (die letzten 5 behalten). Schreiben nur, wenn der
     Pilot es auslöst oder der Sim noch nicht läuft.
   - Danach Hinweis in Tracker und EFB: „3 Vereinsmaschinen bereit – im Mod
     *Import Backup* drücken“. Die Übernahme ist erkannt, sobald `state.txt` die
     neuen Positionen zeigt.
3. **Fehlende Assets:** Mit dem Asset-Scanner prüfen, ob der Titel installiert ist.
   - Nicht installierte Maschinen trotzdem importieren (der Mod kommt damit klar)
     und auf dem Zettel als „nicht installiert“ markieren.
   - Alternativ abschaltbar machen, damit der Hangar übersichtlich bleibt.

### Web / Crew-Brett

- Zettel „Vereinsflotte“ mit diesen Angaben:
  - Kennzeichen, Typ, Platz (nächster Flugplatz)
  - Halter, zuletzt geflogen von, Stand
  - Ausleih-Status
  - Knöpfe „Ausleihen“ und „Zurückgeben“
- Karte mit den Standorten (bestehende Karten-Bausteine).
- Freigabe je Maschine durch den Halter, nie automatisch den ganzen Hangar.

### Ausleihen

- „Ausleihen“ setzt die Sperre im DO. Vorher baut der Tracker die Importdatei,
  damit Position und Flugbuch aktuell sind.
- Solange die Sperre besteht, nimmt die Cloud für diese Maschine nur Uploads des
  Ausleihers an.
- Nach dem Abstellen (neue `rec`-Zeile, am Boden) lädt der Tracker hoch. Die Sperre
  endet automatisch oder per „Zurückgeben“, spätestens nach einer Frist (z. B. 24 h).

### Löschen

Der Import löscht nie. Nimmt der Halter eine Maschine aus der Vereinsflotte, setzt
die Cloud einen Löschvermerk. Die Tracker der anderen zeigen dann: „Nicht mehr in
der Vereinsflotte – im Mod REMOVE drücken“.

## 5. Ausbaustufen

1. **Nur lesen:** Der Tracker liest `state.txt` und lädt freigegebene Maschinen hoch.
   Dazu Zettel und Karte auf dem Crew-Brett. Kein Schreiben in Mod-Dateien.
2. **Importdatei:** Crew-Maschinen per `backup.txt` übernehmen, mit Sicherungskopie und Hinweis.
3. **Ausleih-Sperre** und Rückweg der Position zum Halter.
4. **Flugbuch teilen:** `log`-Zeilen mitschicken, nachdem die Regel für die Summen geklärt ist.

## 6. Offene Punkte

- Summenregel im Flugbuch: neuer `lastFlown` oder Maximum? Test: älterer `lastFlown`
  mit höheren Summen importieren.
- Woran erkennt der Mod doppelte Flüge? Vermutlich an `start`.
- Kopfzeile prüfen (`WHEREILEFTIT-BACKUP|1|…`). Bei unbekanntem Format oder unbekannter
  Mod-Version nichts schreiben, nur lesen.
- Autor (Yetty) fragen, ob die Nutzung der Backup-Datei in Ordnung ist und ob das
  Format stabil bleibt. Vielleicht auch nach einer offiziellen Schnittstelle fragen.
- Steam- und Store-Pfad auf einem zweiten PC prüfen.
