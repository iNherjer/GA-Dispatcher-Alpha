# Aircraft-Presets, Missionsprofile und Gruppen-Boarding

Stand: 2026-08-17
Status: freigegebener Integrationsplan, Umsetzung schrittweise
Rollout: Web-App nach `origin/main`, Tracker-Runtime ausschliesslich ueber den Alpha-Kanal bis zur ausdruecklichen Stable-Freigabe

## Ziel

Die im Flugzeug-Preset gespeicherten Einsatzprofile, Sitzplaetze und spaeter die maximale Zuladung sollen die automatische Missionsauswahl und den Missionsinhalt begrenzen. Eine konkrete Auswahl im Mission Picker bleibt moeglich. Charter-, Privat- und Sightseeing-Missionen koennen bei ausreichender Kapazitaet Paare, Familien, Vereinsgruppen oder kleine Teams enthalten.

Alle Mitglieder einer Gruppe werden in MSFS als eigene Personen gespawnt. Sie stehen beim Start mit etwa einem Meter Abstand beim Van oder Bus, laufen zeitversetzt ueber den bestehenden Boardingpfad zum Flugzeug und steigen nacheinander ein. Am Ziel kommt ein Van oder Bus, die Personen steigen zeitversetzt aus, laufen zum Fahrzeug und werden erst danach gemeinsam uebergeben.

## Nicht-Ziele

- Keine neue Missions-State-Machine fuer Gruppen.
- Keine neuen Boarding-, Deboarding- oder Mission-Completion-Trigger.
- Keine Aenderung an den fachlichen Erfolgskriterien bestehender Missionen.
- Keine automatische Stable-Promotion des Trackers.
- Keine Gruppen fuer Utility-Auftraege ohne konkreten operativen Einsatzzweck.
- Keine Umdeutung von Flugzeugklasse (`SEP`, `MEP`, `SET`, `MET`, `Jet`, `Heli`) in ein Missionsprofil.

## Verbindliche Invarianten

1. `sync.js` orchestriert weiterhin nur UI, Tracker-Kommandos und ACK-Verarbeitung.
2. Manifest und Mission Contract bleiben die fachliche Wahrheit fuer die Anzahl der Passagiere.
3. Eine Gruppe ist im Manifest genau ein Passenger-Item mit `passengerCount`; sie wird atomar geladen und uebergeben.
4. Der vorhandene Ablauf bleibt erhalten:

   ```text
   scene spawn
   -> mission_scene_boarding
   -> passenger_boarded
   -> mission_scene_boarding_ack
   -> Manifest loaded
   -> bestehende Startfreigabe
   ```

5. Der vorhandene Zielablauf bleibt ebenfalls erhalten:

   ```text
   mission_scene_deboarding
   -> cue
   -> door_open
   -> bestehendes Farewell-Gate
   -> passenger_vehicle_boarded / passenger_handoff_complete
   -> mission_scene_deboarding_ack
   -> bestehender Missionsabschluss
   ```

6. `status: ok` ist bei einer Gruppensequenz nur zulaessig, wenn `boarded` beziehungsweise `deboarded` exakt der erwarteten Gruppengroesse entspricht.
7. Teilfehler duerfen weder Manifest noch Mission Runtime fortschalten. Sie nutzen die vorhandenen Fehler-, Timeout- und Recovery-Pfade.
8. Die bestehende Einzelpersonen-Sequenz bleibt ein eigener Legacy-Zweig und wird nicht funktional veraendert.

## Aktueller technischer Ausgangspunkt

- Flugzeug-Presets speichern bereits Name, TAS, Fuel Flow, Sitze, maximale Zuladung, Klasse und Einsatzprofile.
- `passengerCount` wird im Manifest bereits bis sechs gefuehrt.
- Die Web-Szene begrenzt sichtbare Boarder derzeit auf zwei.
- Der Tracker begrenzt Boarding und Deboarding derzeit auf drei Personen.
- Boarding laedt den Passenger-Manifest-Eintrag nach dem finalen ACK atomar.
- Deboarding schliesst den Handoff beim bestehenden Stage-ACK `passenger_vehicle_boarded` beziehungsweise `passenger_handoff_complete` ab.
- Van- und Bus-Assets sind im vorhandenen Szenenkatalog enthalten.

## Begriffe und Datenmodell

### Flugzeugklasse

Die Klasse beschreibt die Bauart und ist vorerst nur bei eindeutig klassengebundenen Auto-Missionen relevant. `sar_heli` darf automatisch nur fuer `Heli` gezogen werden. Eine konkrete Auswahl im Mission Picker bleibt ein bewusster Override.

Zulaessige Werte:

- `sep`
- `mep`
- `set`
- `met`
- `jet`
- `heli`
- `other`

### Einsatzprofile des Flugzeugs

- `touring`: Privat / Reise
- `business`: Business / Charter
- `cargo`: Cargo
- `utility`: Utility / Arbeit
- `bush`: Bush / STOL
- `training`: Training

Keine angehakten Einsatzprofile bedeuten aus Kompatibilitaetsgruenden "keine Einschraenkung". Dieses Verhalten muss in beiden Preset-Editoren sichtbar erklaert werden.

### Passenger Party

Die Gruppeninformation wird additiv zum bestehenden Hauptpassagier gespeichert. Der Hauptpassagier bleibt Sprecher und Voice-Persona.

```js
party: {
    count: 1,
    kind: 'single', // single | couple | family | group | club | business_team
    label: 'Chartergast'
}
```

Der Mission Contract erhaelt zusaetzlich einen Snapshot der bei der Erzeugung aktiven Flugzeugkapazitaet:

```js
aircraftCapability: {
    slotId: 'C172',
    name: 'C172',
    totalSeats: 4,
    crewSeats: 1,
    passengerCapacity: 3,
    maxPayloadKg: 400,
    aircraftClass: 'sep',
    aircraftTags: ['training', 'touring']
}
```

Der Snapshot verhindert, dass ein spaeterer Preset-Wechsel eine bereits erzeugte oder angenommene Mission nachtraeglich veraendert.

## Profil-Kompatibilitaet fuer die automatische Rotation

Der Filter gilt nur, wenn der Picker ein automatisches Profil verwendet. Eine konkret gewaehlte Kategorie oder ein konkret gewaehltes Profil bleibt sichtbar und auswaehlbar.

| Einsatzprofil | APT Auto | POI Auto | Bush Auto |
| --- | --- | --- | --- |
| Privat / Reise | `private_outing`, `sightseeing_tour` | `sightseeing_tour`, `tour_guide_knowledge`, `historian_guided_tour` | keine automatische Freigabe |
| Business / Charter | Kategorie `charter` | keine | keine |
| Cargo | Kategorie `cargo`, `cargo_fragile`, `animal_transport`, materialbezogener `medical_transfer` | sensorbasierte 0-PAX-Varianten spaeter | `bush_supply_strip`, `bush_pickup_cargo` |
| Utility / Arbeit | `club_utility` als konkrete Einzelperson-/Materialmission | `inspection_infra`, `infra_chain_recon`, `mapping_survey`, `science_bio`, `science_geo`, `media_photo`, `news_coverage`, `fire_watch`, `search_and_rescue` | `bush_recon_return`, `bush_supply_strip`, `bush_pickup_strip` |
| Bush / STOL | keine APT-Umdeutung | keine POI-Umdeutung | bestehende Bush-Profile |
| Training | Kategorie `trn` | Kategorie `trn` | keine neue Bush-Trainingslogik |

Utility erzeugt vorerst keine Gruppe. Bestehende Utility-Missionen behalten eine operative Person wie Techniker, Pruefer, Ranger oder Vereinskoordinator. Eine Vereinsgruppe zum Fly-in ist eine Charter-/Reisegruppe mit `party.kind = 'club'`, keine Utility-Gruppe.

## Kapazitaetsregeln

```text
passengerCapacity = max(0, totalSeats - crewSeats)
crewSeats = 1
```

- 1 Gesamtsitz: 0 PAX
- 2 Gesamtsitze: maximal 1 PAX
- 4 Gesamtsitze: maximal 3 PAX
- 6 Gesamtsitze: maximal 5 PAX

Harte Kapazitaetsregeln gelten auch bei manueller Picker-Auswahl. Der Picker bleibt vollstaendig sichtbar; eine physisch unmoegliche Mission zeigt jedoch eine klare Meldung und wird nicht mit einer erfundenen Besetzung erzeugt.

Zulaessige Party-Varianten:

| Freie PAX-Sitze | Zulaessige Party |
| --- | --- |
| 0 | nur 0-PAX-Missionen |
| 1 | `single` |
| 2 | `single`, `couple` |
| 3-5 | zusaetzlich `family`, `group`, `club`, `business_team` |

Training und operative Utility-Profile behalten ihre fachlich benoetigte feste Personenzahl. Cargo ist standardmaessig 0 PAX; eine Begleitung darf nur ein Profil setzen, das diese Rolle ausdruecklich vorsieht.

`passengerCount` ist die Wahrheit. `paxText` wird daraus fuer die Anzeige abgeleitet und bleibt nur fuer Legacy-Restore als Parser-Fallback erhalten.

## Gruppen-Szenenvertrag

### Capability

Der Tracker fuehrt additiv `mission.scene.group.v1` ein. Die Capability wird ueber den vorhandenen Tracker-Hello-Vertrag ausgehandelt.

- Mit Capability: Gruppenparameter und 2-5 sichtbare Personen verwenden.
- Ohne Capability: bestehender Einzel-/Legacy-Szenenpfad; keine Aenderung der globalen Mindest-Tracker-Version.
- Gruppenmissionen werden erst produktiv freigeschaltet, nachdem der Alpha-Tracker mit dieser Capability verfuegbar und getestet ist.

Optionale additive Command-Felder:

```js
{
    groupSequence: true,
    expectedPassengerCount: 4,
    groupSpacingM: 1.0,
    boardingStaggerMs: 2000,
    groupVehicleKind: 'bus' // van | bus
}
```

Alte Tracker ignorieren unbekannte Felder. Die Web-App sendet sie dennoch nur nach positiver Capability-Aushandlung.

### Spawn am Abflug

- Alle Gruppenmitglieder erhalten eigene `person_boarder_N`-Objekte.
- Die Positionen liegen zentriert um den vorhandenen Preset-Spawnpunkt.
- Lateraler Abstand: standardmaessig 1,0 Meter, terrainbedingt mit kleiner Toleranz.
- 2-3 PAX verwenden einen Van.
- 4-5 PAX verwenden Minibus oder Bus.
- Gruppenfahrzeuge verwenden ausschliesslich Van-/Bus-Kandidaten; kein stiller Fallback auf Feuerwehr-, Cargo- oder Personenwagen.
- Unterschiedliche vorhandene Moving-Tarmac-Personenmodelle werden deterministisch variiert.

### Boarding

- Der vorhandene Preset-Pfad bleibt die gemeinsame Grundlage.
- Person 1 startet sofort, jede weitere Person standardmaessig 2000 ms spaeter.
- Jede Person startet an ihrer eigenen Spawnposition und konvergiert danach auf den vorhandenen Pfad.
- Das SimObject wird erst nach Erreichen des Boardingpunkts entfernt.
- `passenger_boarded` und das finale Boarding-ACK werden genau einmal nach der vollstaendigen Gruppe gesendet.
- Bei Spawn-, Pfad- oder Count-Fehler lautet das finale ACK `status: error`; die vorhandene Boarding-Recovery bleibt zustaendig.

### Deboarding

- Van oder Bus kommt vor dem Ausstieg am bestehenden Fahrzeugpunkt an.
- Farewell-, Cue- und Tuer-Gate bleiben unveraendert.
- Alle Gruppenmitglieder spawnen exakt am selben definierten Boarding-/Tuerpunkt;
  beim Spawn wird kein seitlicher Gruppenversatz angewendet.
- Personen steigen seriell aus: Jede Person erscheint am Flugzeugausstieg und
  beginnt sofort ihren Weg; die naechste Person folgt 2000 ms spaeter.
- Die Tuer schliesst erst, nachdem das letzte Gruppenmitglied aus dem Flugzeug gespawnt wurde.
- `passenger_vehicle_boarded` beziehungsweise `passenger_handoff_complete` wird genau einmal nach der vollstaendigen Gruppe gesendet.
- Das Fahrzeug faehrt erst nach Ankunft der letzten Person ab.
- Das finale Deboarding-ACK wird erst nach der bestehenden Fahrzeugabfahrt gesendet.

## Schrittweise Integration

### P0 - Integrationsvertrag

- [x] Diesen Plan lokal anlegen.
- [x] App-Ziel `origin/main` und Tracker-Ziel Alpha dokumentieren.
- [x] Missions- und ACK-Invarianten dokumentieren.

### P1 - Einsatzprofile und Auto-Filter, nur Web-App

- [x] Profil `cargo` in Datenmodell und beide Preset-Editoren aufnehmen.
- [x] Labels auf `Privat / Reise`, `Business / Charter`, `Utility / Arbeit` schaerfen.
- [x] Reine Kompatibilitaetstabelle implementieren.
- [x] APT-/POI-/Bush-Auto-Pools vor der bestehenden Zufallsauswahl filtern.
- [x] Explizite Picker-Auswahl unveraendert lassen.
- [x] Keine Gruppen und keine PAX-Aenderungen in diesem Schritt.
- [x] Unit-/Selftests fuer Filter, leere Auswahl und Picker-Override ergaenzen.

### P2 - Kapazitaet als Mission Contract Truth, nur Web-App

- [x] `aircraftCapability` beim Erzeugen snapshotten.
- [x] `passengerCapacity` zentral berechnen.
- [x] Explizites `passengerCount` und zunaechst nur `single`/bestehende 0-PAX-Varianten einfuehren.
- [x] Feste `2 PAX`-Texte und `Math.max(1, maxSeats - 1)` durch kapazitaetsbasierte positive Varianten ersetzen.
- [x] Manifest liest zuerst `passengerCount`, Textparser bleibt Legacy-Fallback.
- [x] Noch keine Gruppen groesser eins automatisch erzeugen.

### P3 - Gruppenanimation isoliert, Web-App plus Alpha-Tracker

- [x] Capability `mission.scene.group.v1` additiv einfuehren.
- [x] Debug-/Selftest-Sequenzen fuer 2, 3, 4 und 5 Personen bereitstellen.
- [x] Van-/Bus-Auswahl, 1-m-Aufstellung und Stagger implementieren.
- [x] ACK-Counts auf exakte Gruppengroesse absichern.
- [x] Legacy-Einzelpfad und Tracker ohne Capability unveraendert testen.
- [x] Tracker-Version erhoehen, EXE bauen und nur Alpha veroeffentlichen.
- [ ] Realen MSFS-Test fuer Spawn, Wege, Tuer, Van und Bus dokumentieren.

Lokaler Stand 2026-08-17: Tracker v357 ist gebaut. Das Windows-Artefakt hat
48.109.342 Bytes und SHA-256
`fd63d93715a5451482352c941757f3b9709db148d327d31cab90119c007024c6`.
Die EXE enthaelt den neuen Gruppen-Core und die Capability. Release `v357` ist
veroeffentlicht und `channel/alpha.json` auf dieses Artefakt gesetzt;
`stable.json` bleibt unveraendert auf v356. Der reale MSFS-Test steht noch aus.

Beim ersten realen Aufruf wurde der isolierte Debug-Spawn vom Tracker korrekt
als nicht autorisierter missionsgebundener Szenenbefehl abgewiesen
(`ack:conflict`). Der v358-Fix kennzeichnet ausschliesslich die eng validierten
Debug-Szenen `mission-scene-group-debug-(board|deboard)-<2-5>-<timestamp>` als
authority-frei. Sie erhalten weder Mission-/Run-Metadaten noch werden sie im
aktiven Missionslauf als Effekt protokolliert. Alle normalen Szenenbefehle
bleiben unveraendert authority-pflichtig. Der erneute reale MSFS-Test erfolgt
daher mit Tracker v358 oder neuer. Der lokale v358-Build hat 48.110.783 Bytes
und SHA-256
`46d13bed5983410f94fb0c8e5028de3d2896ccf62841e440ceee63e668b56af0`.
Release `v358` ist veroeffentlicht und `channel/alpha.json` zeigt auf exakt
dieses Artefakt; Stable bleibt unveraendert auf v356.

Der reale Gruppentest bestaetigte danach die korrekte Authority-Isolation,
zeigte aber einen zu kleinen Personenabstand und einen zweigeteilten
Deboarding-Ablauf (erst alle spawnen, danach alle loslaufen). Tracker v361
setzt den Standard-Stagger fuer Boarding und Deboarding auf 2000 ms. Beim
Deboarding werden Spawn und Laufstart nun pro Person seriell gekoppelt; erst
2000 ms nach dem Laufstart folgt die naechste Person. ACK-, Manifest-, Voice-
und Runtime-Logik bleiben unveraendert. Der lokale v361-Build hat 48.113.368
Bytes und SHA-256
`43b7aaddd0809f3ad6f10b4586aa0286d4861f142778a146e2139e0b49aa29f4`.
Release `v361` ist veroeffentlicht und nur in `channel/alpha.json` aktiviert;
Stable bleibt unveraendert auf v356.

Der anschliessende Realtest zeigte, dass der seitliche Aufstellungsversatz beim
Deboarding einzelne Personenmodelle in den Flugzeugrumpf setzte. Tracker v362
verwendet deshalb fuer alle Gruppenmitglieder exakt denselben definierten
Boarding-/Tuerpunkt als Spawnposition. Der 1-m-Versatz am Abflug-Boarding und
die aufgefaecherten Laufwege bleiben bestehen; nur der serielle Deboarding-
Spawn ist jetzt deckungsgleich. Der lokale v362-Build hat 48.113.280 Bytes und
SHA-256
`6d39d93a413ee18b0534fdd0c80f0167edf56a3cfaef7a838ee2acf9ff15c060`.
Release `v362` ist veroeffentlicht und nur in `channel/alpha.json` aktiviert;
Stable bleibt unveraendert auf v356.

Der reale Test kann ohne Missionsfortschritt in der Browser-Konsole ausgefuehrt
werden. Die Debug-Sequenzen verwenden eigene Szenen- und Command-IDs; ihre ACKs
werden vor Manifest, Runtime und Voice abgefangen:

- `await missionSceneGroupDebug.boarding(2)` bis `boarding(5)` testet Spawn,
  1-m-Aufstellung, Stagger, Tuer, Boarding und Fahrzeugabfahrt.
- `await missionSceneGroupDebug.deboarding(2)` bis `deboarding(5)` testet
  Fahrzeugankunft, zeitversetzten Ausstieg, Weg zum Fahrzeug und Abfahrt.
- `await missionSceneGroupDebug.clear()` entfernt die zuletzt verwendete
  Debug-Szene.

### P4 - Gruppenmissionen freischalten, nur Web-App

- [ ] Party-Typen fuer Charter, Private Outing und Sightseeing einfuehren.
- [ ] Familie, Freundesgruppe, Verein und Business-Team nur bei ausreichender Kapazitaet ziehen.
- [ ] Hauptpassagier bleibt Voice-Persona; Gruppenlabel und Count bleiben konsistent in Story, Contract und Manifest.
- [ ] Utility bleibt ohne neue Gruppenvarianten.
- [ ] Gruppenfreigabe an getestete Capability koppeln, ohne die globale Mindestversion anzuheben.

### P5 - Maximale Zuladung

- [ ] Personen- und Frachtgewicht gemeinsam gegen `maxPayloadKg` pruefen.
- [ ] Cargo-Pools positiv nach verbleibender Zuladung waehlen.
- [ ] Keine nachtraeglichen Verbotsregexe zur Reparatur zu grosser Ladungen verwenden.
- [ ] Fuel Flow bleibt Planungs-/Kosteninformation und ist kein Missionsprofilfilter.

### P6 - Rollout

- [ ] Vor App-Push `sw.js` Cache-Version erhoehen.
- [ ] Im gemischten Worktree nur die explizit zugehoerigen Dateien stagen.
- [ ] App nach `origin/main` pushen.
- [ ] Tracker-Release als unveraenderliches `v<code>`-Artefakt veroeffentlichen.
- [ ] Nur `ga-tracker-client/channel/alpha.json` aktualisieren.
- [ ] `stable.json` bleibt bis zur ausdruecklichen Testerfreigabe unveraendert.
- [ ] Bei jeder Tracker-Aenderung EXE neu bauen und Remote-Groesse/SHA-256 verifizieren.

## Testgates

Jede Phase muss ihre eigenen Tests bestehen, bevor die naechste produktiv aktiviert wird.

### P1/P2

- `touring` zieht keine Utility-, Cargo- oder Trainingsprofile.
- `business` kann APT-Charter ziehen.
- `cargo` kann Cargo, aber keinen Privat-/Sightseeing-Auftrag ziehen.
- `utility` zieht nur bestehende operative Profile.
- Keine Tags verhalten sich wie der bisherige ungefilterte Auto-Modus.
- Ein konkretes Picker-Profil bleibt trotz fehlendem Tag erreichbar.
- Cub mit zwei Gesamtsitzen erzeugt niemals mehr als 1 PAX.
- Ein einsitziges Preset erzeugt automatisch keine PAX-Mission.
- Contract, Manifest und sichtbarer PAX-Text tragen denselben Count.

### P3/P4

- Gruppen 2/3/4/5: erwartete Anzahl Personenobjekte und eindeutige Kinds.
- Benachbarte Startpositionen liegen etwa 1,0 Meter auseinander.
- Startzeiten sind monoton und um den konfigurierten Stagger versetzt.
- 2-3 PAX verwenden Van; 4-5 PAX verwenden Minibus/Bus.
- Kein `passenger_boarded` vor Abschluss aller Boarder.
- Kein Handoff vor Abschluss aller Deboarder.
- Teilspawn und Teilroute erzeugen Fehler ohne Manifestfortschritt.
- Doppelte, fremde, verspaetete und stale ACKs bleiben wirkungslos.
- Einzelperson, Bush Pickup, Cargo, APT Arrival, Farewell und Mission Close bleiben regressionsfrei.
- Tracker ohne Capability bleibt mit derselben Web-App nutzbar.

Mindestens auszufuehrende bestehende Suiten:

- `tools/mission-ground-flow-selftest.mjs`
- `tools/mission-passenger-handoff-selftest.mjs`
- `tools/mission-flow-simulation-selftest.mjs`
- `tools/mission-cargo-persistence-selftest.mjs`
- `tools/mission-cargo-object-lifecycle-selftest.mjs`
- `tools/mission-scene-cargo-selftest.mjs`
- `tools/mission-pipeline-dryrun.mjs` fuer die betroffenen Profile
- Tracker-Tests unter `ga-tracker-client/*.test.js`

## Voraussichtlich betroffene Dateien

Web-App:

- `app.js`
- `index.html`
- `styles.css`
- `mission-cargo-core.js`
- `sync.js`
- neue kleine, transportneutrale Test-/Core-Datei falls die Profilmatrix sonst nicht isoliert testbar ist
- `sw.js` erst beim App-Push

Tracker:

- `ga-tracker-client/tracker.js`
- gegebenenfalls `ga-tracker-client/tracker-efb-protocol-core.js` und dessen Tests fuer die additive Capability
- passende Tracker-/Ground-Flow-Selftests
- `ga-tracker-client/channel/alpha.json` erst nach gebautem und verifiziertem Release

Dokumentation:

- dieser Integrationsplan
- `docs/EFB-Development-Plan.md`
- betroffene Missionsreferenzen, sobald Contract-/Manifestfelder produktiv eingefuehrt werden

## Abnahme

Die Gesamtintegration ist erst abgeschlossen, wenn:

1. Auto-Missionen die Einsatzprofile des bei der Erzeugung aktiven Presets beachten.
2. Keine Mission mehr Personen als freie Sitze erzeugt.
3. Gruppenstory, Contract, Manifest, Payload und sichtbare Szene denselben Count verwenden.
4. Alle Gruppenmitglieder gespawnt, zeitversetzt geboardet und am Ziel zeitversetzt zu Van oder Bus uebergeben werden.
5. Die bestehende Mission Runtime exakt dieselben fachlichen Events und Phasen wie vor der Erweiterung verwendet.
6. Die App auf `origin/main` und der neue Tracker zunaechst nur im Alpha-Kanal ausgerollt und real im Simulator getestet wurden.
