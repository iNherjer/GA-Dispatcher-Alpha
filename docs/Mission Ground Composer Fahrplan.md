# Fahrplan Boden-Composer – Pax und Cargo gemeinsam

Stand 12.11.2026 · Entwurf zur Freigabe. Grundlage: [Mission Person Asset Plan](Mission%20Person%20Asset%20Plan.md).
Betrifft die Pax- und Cargo-Darstellung **aller** Missionsarten: Umsetzung je Etappe
nur nach Freigabe des Users, neue Wege hinter Testschaltern.

## 1. Warten auf das komplette Asset-Pack? Nein.

**Empfehlung: jetzt bauen, Figuren laufend nachreichen.**

- Das System ist katalog-getrieben. Eine neue Figur mit `person.appearance` im Pack
  wird beim nächsten Generator-Lauf automatisch Teil des Pools – ohne Codeänderung.
  `tools/release-homebase-pack.mjs` erzeugt die Listen bei jedem Pack-Release neu.
- Jeder Look ist von Anfang an mit Tarmac-Standardfiguren besetzt (Stock-Profile).
  Ohne eigene Figur sieht eine Mission also nie schlechter aus als heute.
- Die eigentliche Arbeit – Bordliste, Composer, Manifest mit einer Figur je Pax,
  Tracker-Tempo, Umbau der Missionsstränge – hängt nicht an der Zahl der Figuren.
  Tests und Live-Proben laufen mit Tarmac plus Wanderin.
- Warten hätte nur einen Nachteil: Die Stränge bleiben länger bei Stichwortsuche
  und Geschlecht-per-Regex.

**Was vorher feststehen muss (sonst wird Nachreichen teuer):**

1. **Die Look-Liste** (`data/mission-person-vocabulary.json`). Neue Werte später
   sind möglich, aber Umbenennen oder Zusammenlegen erfordert Nacharbeit an allen
   Figuren. → Liste vor Etappe A noch einmal bestätigen.
2. **Stock-Profile der Tarmac-Figuren.** Sie tragen Arbeitskleidung; als Rückfall
   für `casual`/`business` bleiben sie sichtbar unpassend – wie heute. Echte Abwechslung
   kommt erst mit eigenen Figuren; Prio-1-Liste der Personenliste bleibt gültig.
3. **Aussehen der Wanderin** kommt mit Pack 0.6.27. Bis dahin ein lokaler Eintrag
   im Generator, der beim Pack-Update automatisch zurücktritt.

## 2. Grundsätze

- Die KI stellt aus Geschichte, Anlass und Aufgabe frei zusammen, wer und was
  mitfliegt (z. B. festlich + Foto → Business-Look + Kamerakoffer). Keine festen
  Kombi-Tabellen.
- Der Composer wählt nur aus den Pools (Looks, Cargo-Formen), erfindet keine Titel.
- Der Code prüft: Look/Form existiert, Geschlecht = Stimme, Saison nach Wetter/Datum,
  Personenzahl, Gewicht bleibt Manifest-Wert. Konkrete Figur und Variante wählt der Code.
- Rückfall: Rolle (`roleProfile`/`taskDomain`) → Look, dann Tarmac. Missionen ohne
  KI-Modus nutzen immer diesen Weg: Auswahl nur aus einer festen Zuordnungsliste
  im Code, kein KI-Abruf.
- Die Wahl wird in der Idee gespeichert (`groundVisual`) und für Rückflug und
  Wiederherstellung übernommen.
- Keine neuen Stichwort- oder Regex-Zuordnungen; bestehende werden am Ende entfernt.
- Jeder Strang bekommt einen eigenen Testschalter und wird einzeln umgestellt.

## 3. Etappen

### Etappe A – Fundament (keine sichtbare Änderung)

| # | Schritt | Dateien | Fertig, wenn |
|---|---|---|---|
| A1 | Personen-Generator: liest `person.appearance` aus dem Katalog + Stock-Profile der Tarmac-Figuren, erzeugt `data/mission-person-assets.js`; Wanderin-Eintrag bis 0.6.27 lokal | `tools/generate-mission-person-assets.mjs`, `data/mission-person-asset-profiles.json` (nur Stock), Aufnahme in `release-homebase-pack.mjs` | jeder Look × Geschlecht hat mindestens eine Figur; Warnung bei Person ohne Aussehen |
| A2 | `/^tarmac_/`-Sperren durch Katalogprüfung ersetzen | `mission-cargo-core.js` (~1821, ~4330), `sync.js` (`_missionSceneMovingPersonCandidates`) | eigene Figur kommt bis zum Tracker-Befehl durch |
| A3 | Figurwahl `pickPersonFigure({look, gender, season, ageBand, seed})` mit Saison aus Wetter/Datum, stabiler Streuung, Rückfall Tarmac | neu `mission-person-figure-core.js`; `sync.js` (`_missionScenePersonTitle`, `_missionSceneMovingPersonTitle`) hinter Schalter | Sommer/Winter nicht mehr gemischt; Unit-Tests |
| A4 | Bordliste `mission-onboard.v1`: Normalizer + Adapter je Ideen-Schema aus vorhandenen Feldern (`passenger`, `passengerCount`, `groupLabel`, `party`, `shipment`, `luggageLabel`, `manifestItems` …) | neu `mission-onboard-core.js` | für jedes Schema aus Abschnitt 4 eine Bordliste aus Fixture-Ideen |
| A5 | Boden-Composer: ein Abruf für Pax-Looks und Packstücke, Validierung, Auflösung, `groundVisual` speichern, Rückfall | neu `mission-ground-visual-core.js` (übernimmt `mission-cargo-visual-core.js`) | Unit-Tests: gültig, ungültig, Rückfall, Rückflug-Identität |
| A6 | Manifest: eine Figur je Pax (`visualPersons[]` analog `visualPieces`), Gruppenabfolge (`party`, `groupSequence`) nutzt dieselben Figuren; Stimme aus derselben Geschlechtsquelle | `mission-cargo-core.js`, `sync.js` (Boarding/Deboarding), `mission-manifest-core.js`, `passenger-voice.js` (nur Lesen) | Einsteigen/Aussteigen zeigt je Pax die gewählte Figur |
| A7 | Tracker: Lauftempo je Figur (`maxWalkKts` begrenzen, Laufzeit mit echtem Tempo rechnen); Gruppen bleiben bei 5 Pax | `ga-tracker-client/tracker.js` (Boarding/Deboarding/Reception) | Wanderin kommt rechtzeitig an der Tür an; EXE nur nach OK |

Tests A: Unit-Tests je Kern, `tools/mission-scene-cargo-selftest.mjs`, `mission-ground-flow-selftest.mjs`,
Tracker-Suite. Sim-Test: Einsteigen/Aussteigen Wanderin + Tarmac gemischt.

### Cargo-Rückfall ohne KI (umgesetzt 13.11.2026, Web v2372)

Befund Feldtest 13.11.2026: Bush-Mission „Vier Wochen Wildnis“ (184 lbs Outdoor-Ausrüstung
und Vorräte) spawnte einen Kaffeebecher. Ursache: In `_missionSceneCargoAsset`
([sync.js](../sync.js)) bestimmte das Gewicht zwar die passende Palette, gezogen wurde aber
per Zufallswert aus der ganzen Palettenliste – darin stehen als Spawn-Ersatz auch
`Cardboard` und `CoffeeCup`.

Umsetzung – Gegenstück zur festen Rollenliste der Pax:

1. **Mit Schalter `ga_person_figures_v1`:** Gibt es keinen Composer-Plan, legt
   `MissionCargoVisualCore.fallbackPlan` (`mission-cargo-visual-core.js`) aus der TaskDomain
   eine feste Form fest (z. B. Bush → Campingausrüstung/Duffel/Rucksack, Charter → Koffer/
   Duffel, Reporter → Kamerakoffer/Hardcase, Fracht → Holzkiste, Verein → Werkzeugkiste)
   und teilt das Gewicht auf 1–3 Packstücke (halbe Pfund, Summe exakt). Quelle im Manifest:
   `cargoVisualSource: 'role-fallback'` (`mission-cargo-core.js`).
   Feuerwache, SAR, Krankentransport und Tiertransport haben keine Einträge – sie nutzen
   weiter ihre eigenen Wege (Drop-Container, Sanitätsausrüstung, Transportboxen).
2. **Ohne Form (und ohne Schalter):** Palette fest nach Gewicht – ab 120 lbs groß
   (`Pallet01_01`), ab 50 lbs mittel, ab 20 lbs klein, darunter Karton.
3. `Cardboard` und `CoffeeCup` sind nur noch Spawn-Ersatztitel, nie gewählter Titel.
4. Tests: `tools/mission-cargo-visual.test.mjs` (Rückfall, Gewichtssumme, Formen je
   TaskDomain), `mission-scene-cargo-selftest.mjs`, `mission-ground-flow-selftest.mjs`;
   Browserprobe 8/30/70/184 lbs → Karton / Palette klein / mittel / groß, stabil.

### Etappe B – Pilot-Stränge (haben heute schon den Cargo-Composer)

| Strang | Ideen-Schema | Pax | Cargo | Besonderheit |
|---|---|---|---|---|
| Reporter am Flugplatz | `apt-news-idea.v1` | Reporter/Team (`passengerCount`, `groupLabel`) | `shipment` (Ausrüstung) | Reporter-Szene mit Zuschauern → Etappe E |
| Charter | `charter-idea.v1` + Fortsetzung | `passengerCount`, `groupLabel`, `party` | `luggageLabel`/`luggageWeightLbs` | Rückflug: gleiche Personen (`mission-charter-continuation-core.js`) |
| Sightseeing | `sightseeing-idea.v1` | wie Charter | wie Charter | Touristen, Alter oft „senior“ |

Fertig, wenn: Live-Gemini-Proben mit ungewöhnlichen Anlässen (Hochzeit, Firmenjubiläum,
Trauerflug, Familienausflug) plausible Looks liefern; Rückflug identisch; Sim-Test.

**Stand 13.11.2026 – Live-Proben bestanden** (`tools/ground-composer-live-probe.mjs`,
Ergebnis `analysis/ground-composer-live-20261113.md`/`.json`, gemini-3-flash-preview,
ein Abruf je Szenario, alle 8 gültig, alle Looks vom Composer):

| Szenario | Looks | Gepäck |
|---|---|---|
| Charter Hochzeit (Fotograf + Assistentin) | business, business | camera_kit + hardcase |
| Charter Firmenjubiläum (3) | 3× business | carton + 2× suitcase |
| Charter Trauerflug (Witwe, Sohn, Tochter) | 3× business (senior/adult/young_adult) | 2× duffel |
| Charter Junggesellenabschied (5) | 5× outdoor | backpack + camping_kit + cooler |
| Sightseeing Familienausflug (Oma, Tochter, 2 Enkel) | business, casual, 2× casual child | cooler + duffel |
| Sightseeing Fotokurs Winter (3) | 3× outdoor → Wanderin als Teilnehmerin | camera_kit + backpack + duffel |
| Reporter Hochwasser | outdoor → Wanderin | 2× backpack |
| Reporter Gala | business | camera_kit + hardcase |

Rückflug in allen 8 Fällen: 0 neue Abrufe, gleiche Looks und Geschlechter. Gewichte
summieren sich exakt.

Befunde für später (kein Fehler im Composer):
- `business` deckt festlich, Trauer und Gala ab. Eigene Looks (`festive`, dunkel/Trauer)
  lohnen sich erst, wenn der Artist dafür Figuren liefert – bis dahin bleibt das Vokabular.
- Kinder (`child`) bekommen mangels Kinderfiguren eine erwachsene Tarmac-Figur. Gewünscht
  in `docs/Person Asset Gewuenschte Modelle.md`; Figurwahl ignoriert die Altersgruppe solange.
- Offen für Etappe B: Sim-Test mit Schalter (Charter/Sightseeing/Reporter je einmal).

**Mitreisende aus der Idee (13.11.2026, Web v2377, 4051e7e05):** Feldtest zeigte „Kollege“ in
der Geschichte, aber eine Frau als zweite Figur – Writer und Composer liefen parallel und
rieten das Geschlecht der Begleiter unabhängig. Jetzt liefern Charter- und Sightseeing-Idee
`companions:[{role,gender}]` (genau `passengerCount − 1`). Der Writer ist daran gebunden,
die Bordliste übernimmt Rolle und Geschlecht fest, der Composer wählt nur noch Look/Alter.
Fehlt die Liste oder passt die Anzahl nicht, bleibt sie leer und alles läuft wie vorher (keine
abgelehnte Idee). Rückflug übernimmt die Liste über `original`. Live-Probe: 4 Charter, alle
Begleiter mit Geschlecht, Writer hält sich daran (Schatzmeisterin/Beisitzer, Wart/Jugendwartin).

### Empfang am Zielplatz: Fahrzeug, Aufräumen, EFB (13.11.2026, Tracker v634 Alpha / Web v2380)

Feldtest Charter EDTO→EDTL mit 2 Pax: Die Empfangsszene stellte einen Pkw, der Tracker
verlangt für Gruppen aber ein Gruppenfahrzeug (`GROUP_VEHICLE_TITLES`) – er verwarf den Pkw,
brachte einen eigenen Van, und Pkw + Empfangsperson blieben nach dem Abschluss stehen. Im
EFB fehlte der Abholpunkt (die Web-Karte zeichnet ihn selbst, der Tracker schickte ihn nicht).
Betrifft alle Missionen mit APT-Empfangsszene (Charter, Sightseeing, Reporter, Fracht mit
Begleiter, Medizin, Verein, Rückflüge); Bush-Abholungen haben einen eigenen Weg.

1. **Sofort live (Web v2378):** Bei Gruppen nimmt die Empfangsszene das Gruppenfahrzeug,
   damit der Tracker sie für das Aussteigen übernimmt (`_missionAptArrivalAssetForItem`).
2. **Fahrzeugregel v2** (`ga-tracker-client/mission-scene-group-core.js`, gemeinsam für
   Tracker und Web): 1–2 Pax Pkw, 3–5 Pax Van, Bus wird nicht mehr gewählt, Patiententransport
   unverändert Sanitäter. Große/schwere Fracht → Van, auch für Einzelgäste: ab **100 lbs**
   gesamt oder mit sperrigem Stück (Holzkiste, Palette, großes Packstück) –
   `_missionSceneCargoNeedsVan` in `sync.js`. Die Regel steckt im Befehl (`vehicleRule: 'v2'`,
   `groupVehicleKind`), alte Befehle behalten v1 (bis 3 Van, sonst Bus).
   Der Van für Einzelgäste mit großer Fracht ist sofort live (kein Tracker-Bezug); die
   Gruppenregel schaltet scharf, sobald dieser Browser zuletzt einen Tracker ab v634 gesehen hat
   (`_missionSceneVehicleRuleV2`, gemerkt in `localStorage` `ga_last_tracker_version_code`),
   sonst wählte die App einen Pkw, den ein alter Tracker verwirft.
3. **Aufräumen** (`tracker.js`, `tracker-mission-simulator-effects.js`): Wird die
   Empfangsszene beim Aussteigen nicht übernommen (falscher Typ, Flugzeug > 0,12 NM entfernt),
   räumt der Tracker sie nach dem Aussteigen ab (`SCENE_DEBOARDING_ARRIVAL_CLEANUP`).
4. **EFB-Abholpunkt** (`tracker-efb-map-snapshot-core.js` → `missionGeometry.arrival`,
   `tracker-efb-kartentisch-host.js`): oranger Punkt „Abholteam“ wie in der Web-App; nur wenn
   die Empfangsszene tatsächlich gespawnt wird.

**Ausgeliefert in Tracker v634 Alpha (13.11.2026):** Die Mindestversion bleibt bei v470 –
eine Anhebung auf 634 hätte Stable-Nutzern (v631) das Abschied-Aussteigen gesperrt
(`missionSceneDeboarding` mit `coordinateFarewell`) und die Update-Meldung gezeigt. Stattdessen
gilt der zuletzt gemeldete Tracker. Wird Stable auf v634 gehoben, kann die Mindestversion folgen.
Tests: Tracker-Suite 1561/0 Fehler, `mission-scene-group-core.test.js` (Regel v1/v2),
`tracker-mission-simulator-effects.test.js` (Aufräum-Kennung), `tracker-efb-map-snapshot-core.test.js`
(Abholpunkt). Feldtest danach: 2 Pax → Pkw, 3 Pax → Van, 1 Pax mit 150 lbs → Van; Empfangsfahrzeug
fährt mit; nichts bleibt stehen; Punkt im EFB.

### Grundregel für alle weiteren Stränge: Mitreisende aus der Quelle

Seit 13.11.2026 liefern Charter und Sightseeing `companions:[{role,gender}]`; die Bordliste
gibt dem Composer damit je Begleiter Rolle und festes Geschlecht, er wählt Look und Alter
passend zur Rolle (z. B. Technischer Wart vs. Jugendwartin). Jeder Strang in Etappe C und D,
der mehr als eine Person befördert, bekommt dasselbe, bevor er an den Composer geht:

- **Mit Ideen-KI** (Fracht, empfindliche Fracht, Tiertransport, Medizin, Verein, Reporter-Team
  falls Gruppen kommen): `companions` im Ideen-Prompt und in `validate`, tolerant wie bei
  Charter (fehlt/passt nicht → leer, Idee bleibt gültig), Writer-Regel „Begleiter verbindlich“,
  Adapter in `mission-onboard-core.js` reicht `companions` durch.
- **Ohne Ideen-KI** (Privatflug, Bush-Gäste, Bush-Abholung mit Begleitperson): Begleiter aus
  Persona/Profil bzw. `pickupPassengerCount` + Begleitrolle ableiten; Geschlecht fest, sobald
  Text oder Stimme es festlegen, sonst offen für den Composer.
- **Medizin:** Patient und Begleitung sind eigene Rollen (`uses: patient`, Begleitung `medical`).
- Test je Strang: Geschichte nennt die Begleiter so, wie die Figuren einsteigen; Rückflug gleich.

### Etappe C – Privat und Bush (Einsatz der Wanderin)

| Strang | Quelle | Pax | Cargo | Besonderheit |
|---|---|---|---|---|
| Privatflug | `mission-private-outing-core.js` (Persona-Profile) | Persona (`name`, `role`, `gender`, `personality`, `storySeed`) | Gepäck aus Aktivität | keine Ideen-KI → Bordliste aus Persona; Composer optional |
| Privat-Rückflug | `mission-private-return-core.js` | dieselbe Person (`voiceIdentity`) | Rückgepäck | Figur muss identisch bleiben |
| Bush-Abenteuer / Bush-Charter-Gast | `mission-bush-narrative-core.js` (`bush_adventure_guest_v1`, `bush_charter_guest_v1`) | Gast | Camping/Ausrüstung | Outdoor-Look naheliegend, nicht erzwungen |
| Bush-Abholung | `mission-bush-pickup-scene-core.js` (`bush_pickup_guest_v1`, `pickupPassengerCount`, Begleiter) | wartet am Zielplatz | Rückfracht/Ausrüstung | Ankunftsszene, Begleitperson, Abholfahrzeug |

**Stand 13.11.2026 (Web v2381):**
- **Privatflug** (`private-outing.v1`, V5 und V6 inkl. Auswahl-Vorschlag): Adapter in
  `mission-onboard-core.js` (ein Mitflieger, Rolle = Beziehung, Geschlecht fest aus der Idee,
  Gepäck = `luggage`). Der Composer läuft hinter `ga_person_figures_v1` parallel zum Writer
  (`fetchPrivateOutingStory` in `app.js`) und schreibt `groundVisual` + `cargoVisual` in die Idee;
  `postFromIdea`/`ideaOf` in `mission-cargo-visual-core.js` kennen den Privatflug. Fehler bleiben
  folgenlos (feste Liste `casual`). Live-Probe (`analysis/ground-composer-private-20261113.json`):
  Tante Weihnachtsmarkt → business/senior, Winterfigur; Schulfreund Angeln → outdoor;
  Schwester Vorstellungsgespräch → business.
- **Privat-Rückflug:** `privateReturn.outing` übernimmt `groundVisual`/`cargoVisual`
  (`mission-private-return-core.js`), der Rückblick-Writer sieht sie nicht. Baut der Tracker den
  Rückflug-Antrag, greift das erst mit dem nächsten Tracker (Release Queue); bis dahin nimmt der
  Rückflug die feste Liste.
- **Bush** (Abenteuer, Charter-Gast, Abholung): ohne Ideen-KI, daher feste Rollenliste
  (`outdoor`, Abholerin → Wanderin). Kein Composer-Abruf, kein Eingriff in die Bush-Writer.
  Begleiter der Bush-Abholung bleiben offen (gestreut), bis die Quelle Rolle/Geschlecht liefert.
- Offen: Sim-Test Privatflug hin/zurück und Bush-Abholung mit Schalter.

### Composer für alle Missionen (13.11.2026, Web v2382)

User-Entscheidung: Der Composer wählt für **alle** Missionen die passende Pax-/Cargo-Kombination,
Bush eingeschlossen. Statt jeden Strang einzeln anzuschließen, gibt es einen gemeinsamen Schritt:

- `mission-ground-composer-browser.js` startet nach dem Erstellen (in `generateMission`, nachdem
  der Missionsvertrag angehängt ist) im Hintergrund, nur mit Schalter `ga_person_figures_v1` und
  KI-Modus. Übersprungen werden Stränge mit eigenem Composer (Charter, Sightseeing, Reporter,
  Privatflug, Rückflug mit übernommener Wahl).
- Quelle `mission-ground-source.v1`: Hauptperson aus dem Passagierprofil (Rolle, Geschlecht),
  Personenzahl (`_missionCargoPassengerCount`, bei Bush-Abholung `pickupPassengerCount`), Anlass aus
  Titel, Story-Kern und Briefing-Anfang, Gepäck/Fracht genau so, wie die Ladeliste es führt
  (`_missionCargoGenerateManifest`: `primary-cargo` bzw. `pickup-companion-cargo`). Reine
  Frachtflüge haben keine Personen, nur Ladung (`mission-onboard-core.js` erlaubt das jetzt).
- Eigene Ladungs-Pools bleiben unberührt (Feuer, SAR, Medizin, Tiere): dort wählt der Composer nur Looks.
- Ergebnis in `currentMissionData.groundComposer` (in beiden Speicher-Listen ergänzt); Figuren
  über `_missionSceneGroundIdea`, Gepäck über `ideaOf`. Die Bush-Abholung nutzt die Figuren jetzt
  auch für `pickup-passenger` (`visualPersons`).
- Beim Annehmen wartet die App höchstens 8 s auf einen noch laufenden Abruf
  (`_publishSharedMissionReplacement`), sonst gilt die feste Rollenliste.
- Browser-Probe (KI-Antwort simuliert): Bush-Abholung 2 Pax → Wanderin (outdoor) + Kollege
  (workwear), Gepäck → Hartschalenkoffer + Tasche; Frachtflug 120 lbs → Holzkiste, keine Personen.
- Begleiter mit Rolle/Geschlecht aus der Quelle (Grundregel oben) bleiben je Strang offen; bis
  dahin legt der Composer das Geschlecht der Mitreisenden aus Anlass und Gruppe fest.
- Offen: Live-Proben mit echten Missionen (Bush, Fracht, Verein, Medizin), Sim-Test.

### Personen aus der Quelle, Strang für Strang (ab 13.11.2026)

User-Entscheidung: Kein Umbau aller Stränge auf eine neue Idee-Stufe. Stattdessen liefert die
Stufe, die die Geschichte ohnehin entscheidet (Idee oder Writer), die Personen an Bord strukturiert
(Rolle, Geschlecht je Mitreisendem) und der Strang hängt sich wie Charter direkt an den Composer –
parallel zum Writer, ohne zusätzlichen Abruf für die Personendaten. Der allgemeine Schritt oben
bleibt Rückfall für Stränge, die noch nicht umgestellt sind.

**Pflicht je Strang:** Ein Live-Abruf bestätigt, dass Idee/Writer die Daten sauber ausgibt und der
Composer darauf passende Looks/Packstücke wählt (`tools/ground-composer-strand-probe.mjs
--run --strand=<name>`, Ergebnis in `analysis/ground-composer-<strang>-*.md`).

| Strang | Stand | Quelle |
|---|---|---|
| Verein | ✅ Web v2383 | `club-idea.v1` hatte schon eine Idee-Stufe mit genau einem Vereinskollegen (Name, Rolle, Geschlecht), `luggage` und optionaler `delivery`. Adapter in `mission-onboard-core.js` (c1 = Lieferung sonst Gepäck, c2 = Gepäck), Composer parallel zum Vereins-Writer (`mission-club-browser.js`). Die Ladeliste übernimmt jetzt auch weitere Composer-Posten (`club-luggage` neben `primary-cargo`). Live-Probe: 3/3 Ideen gültig, Looks/Packstücke passend (`analysis/ground-composer-club-20261113.md`); Lieferung + Gepäck zusammen im Browser mit echter Ladeliste geprüft. |
| Training | ✅ ohne Umbau | Fluglehrer/-in aus fester Personenliste (`INSTRUCTOR_PERSONA_LIBRARY`, Geschlecht fest), Gepäck aus `TRAINING_CARGO_ITEMS`, immer genau 1 Pax; der Writer entscheidet keine Personen. Der allgemeine Composer-Schritt bekommt damit exakte Daten. Live-Probe 3/3 passend (`analysis/ground-composer-training-20261113.md`). |
| Medizin | ✅ Web v2384 | `medical-transfer-idea.v1` legt Fachperson/Kurier (Rolle, Geschlecht) und beim Patiententransfer den Patienten (Geschlecht) fest. Adapter ohne Gepäckposten (Sendung behält den Medizin-Pool), Composer parallel zum Medizin-Writer. Beim Patiententransfer baut die Szene Begleitung und Patient weiterhin selbst (Krankenwagen, keine Composer-Figuren). Live-Probe: alle drei Transportarten gültig, Patientengeschlecht übernommen (`analysis/ground-composer-medical-20261113.md`). |
| POI-Aufträge | ✅ Web v2385 | Alle zehn POI-Stränge haben genau eine Person aus der Idee und festes Gepäck → allgemeiner Composer-Schritt mit exakten Daten. Kette, Feuer, Geo, Wissen, Kartierung und SAR lieferten das Geschlecht schon. **Bio, Infrastruktur, Reporter-POI und Foto** lieferten nur Name/Rolle: Die Stimme fiel dann immer auf weiblich (`_normSpeakerGender`), die Szene riet aus der Rolle (meist männlich) – Figur und Stimme konnten sich widersprechen. Diese vier Ideen-Prompts verlangen jetzt `gender` (female/male), die Prüfung lehnt falsche Werte ab, ältere gespeicherte Vorschläge ohne Feld bleiben gültig. Live-Probe: Geschlecht in allen vier Ideen vorhanden, Composer passend (`analysis/ground-composer-poi-20261113.md`; die Reporter-Idee scheiterte dort an der Szenenabsicht ohne Szenen-Fähigkeiten im Probe-Rahmen, Person sauber). |
| Fracht, zerbrechliche Fracht, Tiertransport | ✅ Web v2386 | Alle drei mit Idee-Stufe. Fracht (`cargo-idea.v1`): keine Person, Sendung **mit Verpackung und Handhabung** an den Composer (vorher nur Text/Gewicht aus der Ladeliste). Zerbrechliche Fracht: ein Kurier (Rolle, Geschlecht) plus Sendung mit Verpackung/Bruchhinweis. Tiertransport: Begleitperson, Tiere behalten ihren eigenen Pool (nur Look). Composer jeweils parallel zum Writer. Live-Probe: 6/6 Ideen gültig, Kartons/Hartschalen/Holzkiste folgen der Verpackung (`analysis/ground-composer-freight-20261113.md`). Dabei gefunden: Beschreibt die Verpackung mehr als drei Stücke („4 Kunststoffkisten“), lieferte die KI vier und die ganze Wahl wurde verworfen → jetzt werden die ersten drei genommen und das Gesamtgewicht darauf verteilt (`mission-cargo-visual-core.js` `validate`). |
| Bush | ✅ ohne Umbau | Bush hat keine eigene Idee-Stufe: die Person legt der allgemeine V4-Writer fest (`passenger` mit `role`, `gender`), bei der Abholung übernimmt der Dispatch genau diese Writer-Person als Abholgast (`app.js`, `hasAiPickupPassenger`), das Pickup-Gepäck kommt aus `bush.pickupCargoLabel`. Der allgemeine Composer-Schritt bekommt damit exakte Daten; kein Eingriff in die Bush-Writer (mit dem Bush-Agenten abgestimmt, dessen Arbeit war abgeschlossen). Live-Probe 13.11.2026 mit dem echten Planer/Writer (`tools/bush-profile-personality-live.mjs --run=composer-20261113`): Abholung (Kartenmacherin, weiblich → Wanderin, Kameraausrüstung + Rucksack), Bush-Charter (Leiter der Trail-Crew, männlich → Outdoor-Look, Hartschale + Werkzeugkiste), Versorgung ohne Person (Hartschale + Holzkiste) – alle passend (`analysis/ground-composer-bush-20261113.md`). Nachtrag 14.11.2026 (Web v2389, `analysis/ground-composer-bush-rest-20261114.md`): Abenteuer-Hopper (Naturfilmer → Outdoor, Kameratasche + Rucksack), Aufklärung (Infrastruktur-Prüferin → Arbeitskleidung, Hartschale + Tasche) und Fracht-Abholung ohne Person ebenfalls live passend. Bei der Fracht-Abholung kannte der Composer den Ladelisten-Posten `pickup-cargo` nicht, die Rückholfracht blieb immer ein Karton; jetzt Hartschale, Werkzeugkiste und Aktentasche für „Generatorstarter, Riemensatz und Prüfmappe“ (`mission-ground-composer-browser.js`, `_missionCargoApplyVisualPlan`, Rückfall). |

### Für alle eingeschaltet (14.11.2026, Web v2388)

User-Entscheidung nach dem Vereins-Testflug: Personen-Figuren und Composer gelten für alle, die
Auswahl „Figuren (Test)“ in den Boarding-Einstellungen ist entfernt. `ga_person_figures_v1`
bleibt nur als Notausschalter je Gerät: Wert `off` (per Adresszeile `?personFigures=off`,
`?personFigures=on` hebt ihn auf). Die Diagnosezeile „PAX-Figuren“ zeigt den Stand.

Dabei behoben (Code-Check): Passte eine Composer-Wahl nicht mehr zur Ladeliste (Text oder
Gewicht, z. B. nach Preset-Wechsel), blieb das Gepäck ganz ohne Wahl und fiel auf die alte
Stichwort-Zuordnung zurück. Jetzt gilt dann die feste Packstück-Liste
(`_missionCargoApplyVisualPlan` → `_missionCargoApplyFallbackVisualPlan`).

Offen bleiben Sim-Tests der übrigen Stränge (laufen jetzt bei allen Testern mit), Etappe E und F.

### Rückflüge und Fortsetzungen: gleiche Figur (14.11.2026, Web v2389)

Privat-Rückflug und Charter-/Reporter-Rückreise behielten den Look des Hinflugs, die konkrete
Figur wurde aber mit der Missionskennung ausgelost – der Rückflug hat eine neue, also konnte bei
gleichem Look eine andere Tarmac-Figur kommen. Jeder gespeicherte Plan trägt jetzt einen eigenen
Losschlüssel (`groundVisual.figureSeed`), der mit dem Plan in Rückflug und Fortsetzung reist;
`resolveFigures` nutzt ihn vor der Missionskennung. Ältere Pläne ohne Schlüssel losen wie bisher.

Bush- und POI-Folgemissionen (User-Freigabe 14.11.2026, Web v2390): Die Folgemissions-Anfrage
nimmt die Wahl der Hauptperson aus dem allgemeinen Composer mit (`groundCarry`, Schema
`ground-carry.v1`: Name, Geschlecht, Look, Alter, Losschlüssel; `mission-followup.js`
`groundCarryFrom`, läuft auch im Tracker headless). Die Folgemission übernimmt sie nach ihrem
Composer-Abruf (`mission-ground-composer-browser.js` `carryFor`/`applyCarry`), aber **nur bei
derselben Person** (Name gleich, Geschlecht nicht widersprüchlich) – der Techniker nach einer
Aufklärung wählt neu. Das Feld fehlt, wenn es nichts zu übernehmen gibt; es geht in keinen
Writer-Prompt. Anfragen, die der Tracker anlegt, tragen das Feld erst ab dem nächsten Tracker-Build
(Release Queue). Ohne KI-Modus läuft der Composer nicht, dann gilt weiter die feste Liste.

Bordprüfungen (`flight_compliance`, `ground_inventory`): kein Composer nötig. Es sind
Inventar-Sitzungen mit fester Bordausrüstung, kein `generateMission`; der Composer läuft dort nie.

### Etappe D – übrige Missionsstränge (einzeln, je Testschalter)

| Strang | Quelle | Pax | Cargo | Besonderheit |
|---|---|---|---|---|
| Fracht | `cargo-idea.v1` | Begleiter optional (`passengerCount`) | `shipment` | Empfänger am Ziel → Etappe E |
| Empfindliche Fracht | `fragile-cargo-idea.v1` | Begleiter | `shipment` (Handhabung) | Empfänger |
| Tiertransport | `animal-transport-idea.v1` | Begleiter | Tierbox (`animalCount`) | Tierbox bleibt eigener Pool |
| Medizin-Transfer | `medical-transfer-idea.v1` | gehfähiger Patient + Begleitung (`patientCount`, `patientTransferEnabled`) | Medizinkoffer | Gruppenfahrzeug `medical`; Patient als Pax-Figur (`uses: patient`, sonst passender Alltags-Look), Begleitung `medical` |
| Verein | `club-idea.v1` | Vereinsmitglieder | `manifestItems` (Pflicht vs. persönlich) | mehrere Posten |
| Training | `mission-training-flight-core.js` (`instructor_calm_precise_v1`) | Fluglehrer | – | Look `aviation` naheliegend |
| POI-Foto | `poi-photo-idea.v1` | Fotograf | Kamera (`deliverable`) | |
| News (POI) | `news-idea.v1` | Reporter | Ausrüstung (`deliverable`) | Szene → Etappe E |
| Biologie | `bio-idea.v1` | Forscher | Ausrüstung | Tiergruppen bleiben Szene |
| Geologie | `geo-idea.v1` | Forscher | Ausrüstung | |
| Infrastruktur | `infra-idea.v1` + Kette | Inspektor | Ausrüstung | Look `workwear` naheliegend |
| Vermessung | `mapping-idea.v1` | Vermesser | Kamera/Messkoffer | |
| Wissen/Führung | `mission-knowledge-briefing-core.js` | Guide/Historiker | – | |
| Brandwache | `fire-alarm-idea.v1` | Beobachter | Einsatzladung (`fireCargo`) | Feuerpfad bleibt eigen; Look `fire_rescue` naheliegend |
| SAR | `mission-sar-briefing-core.js` | Beobachter | SAR-Ausrüstung (`sarCargo`) | Vermisste → Etappe E |
| POI-Kette | `mission-chain-briefing-core.js`, `mission-poi-chain-core.js` | wie Grundstrang | – | erbt Bordliste |
| Bordprüfungen | `flight_compliance`, `ground_inventory` | keine | Bordausrüstung (Bordbuch, Löscher …) | nur Cargo, feste Objekte, prüfen ob Composer nötig |
| Freiflug | `freeflight_planning` | keine | – | nicht betroffen |

### Etappe E – Personen am Ziel und in Szenen

| Bereich | Quelle heute | Ziel |
|---|---|---|
| Abholer/Bringer am Boden (holt Pax ab oder bringt ihn) | heute Fahrzeug + Tarmac | Figuren mit `uses: escort`, z. B. Wanderin bei Wander- und Ausflugszielen |
| Empfang am Ziel (Empfänger, Abholer, Klinikteam, Tour-Abholung) | `mission-definition-core.js` Ankunftsrollen, alle `person.ground_crew`; `sync.js` ~6480 | Ankunftsrolle bekommt Look-Hinweis; Composer darf Empfangsperson mitwählen |
| Abhol-Empfang beim Aussteigen | `tracker.js` `planPickupReception` | gleiche Figurwahl wie A3 |
| Reporter-/POI-Szenen (Zuschauer) | `person.bystander`, explizite Anforderungen | Pool aus `uses: bystander` |
| SAR-Vermisste | `sar.person_target` (`mmh_HikerRescue` …) | optional eigene Figuren (z. B. Wanderin liegend/winkend – eigene Animation nötig) |
| Bodenpersonal/Marshaller | Stock | unverändert, später `uses: ground_crew` |

### Etappe E – Arbeitsteilung und Umsetzung (ab 14.11.2026, Web v2392/v2393)

Entscheidung mit dem User (14.11.2026): Szenenplaner und Composer werden **nicht**
zusammengelegt, sondern sauber getrennt.

| Stufe | Wann | Entscheidet |
|---|---|---|
| Idee | Generierung | **Wer** da ist: Mitreisende, Bringer, Empfänger (`groundCast: { start: [{ role, gender }], arrival: [...] }`) |
| Composer | Generierung | **Wie** es aussieht: Figur je Person, Packstücke, **Fahrzeugart je Szene** (Start und Ziel unabhängig) |
| Szenenplaner V3 | Annahme | **Wo** es steht: Empfangsplatz, Positionen; POI-Zielszenen bleiben ganz bei ihm |

**Schritt 1 (umgesetzt):** Die Bordliste (`mission-onboard-core.js`) trägt `scenes.start.crew`
(Bringer) und `scenes.arrival.crew` (Empfänger). Ohne `groundCast` gilt je Szene eine neutrale
Person, eine leere Liste heißt „niemand“. Der Composer (`mission-ground-visual-core.js`) wählt
je Szene Look/Alter/Geschlecht der Personen und die Fahrzeugart aus einer **vorab nach Plätzen
geprüften** Liste (`vehicleOptions`). Sitze inklusive Fahrer: Quad 2, Pick-up 3, Pkw 5, Van 8,
Bus 20, Krankenwagen 3 (nur Patiententransfer am Start). Alle in der Szene (Mitreisende plus
Bringer bzw. Empfänger) müssen passen. Ab 100 lbs oder mit sperrigem Stück nur Pick-up/Van/Bus.
Das Quad gibt es nur am Buschstreifen selbst (Ziel) mit höchstens 100 lbs. Gruppen (2–5) bleiben
in der Tracker-Fahrzeugregel v2 (2 Pkw/Van, 3–5 Van). Eine ungültige KI-Wahl fällt auf das
kleinste passende Fahrzeug zurück (`vehicleSource: 'capacity'`). Alte Pläne ohne Szenen bekommen
sie beim Rückflug nach Platzregel. Live-Probe: `analysis/ground-composer-scenes-*-20261114.md`.

**Schritt 2 (umgesetzt):** Die Startszene (`sync.js`) nimmt die Fahrzeugart aus dem Plan
(`_missionSceneComposerVehicleAsset`, „truck“ = Pick-up/Utility, keine Lkw) und setzt die Bringer an
die Stelle der festen „Crew Fahrzeug“-Figuren (sie steigen ein und fahren mit weg). Die
Abholung am Ziel ohne Planer-Empfang nimmt das Zielfahrzeug. Unverändert: Gruppen (Tracker-Regel),
Feuer, SAR, Medizin, schwere Fracht schlägt Pkw/Quad, Notaus `ga_person_figures_v1 = 'off'`.

**Schritt 3 (umgesetzt, Web v2393):** Der Szenenplaner V3 bekommt im Kontextpaket
`receptionCast` (`scenePlannerV3ReceptionCast`, app.js): Fahrzeugrolle der Ziel-Szene immer, die
Personen nur, wenn sie aus der Idee kommen (`castFixed`); sonst plant er Personen wie bisher, höchstens
`maxPersons` (Plätze minus Mitreisende). Prompt-Regel 4c: keine weiteren Fahrzeuge, er wählt nur Platz,
Ausrichtung und Offsets. Die Plausibilitätsprüfung akzeptiert die vorgegebene Fahrzeugrolle, damit
seine Aufstellung nicht auf die Grundrolle zurückfällt. Die Zielszene (`_missionAptArrivalSceneItems`)
setzt die Besetzung auch durch, wenn der Planer abweicht oder nicht lief: Fahrzeug aus dem Composer,
Personen der Reihe nach mit den Empfänger-Figuren, bei fester Besetzung überzählige Personen weg, sonst
Begrenzung auf die Plätze. Die wartende Bush-Abholperson trägt die Figur des Pax. Live-Probe mit
Freiburg-Geometrie: `analysis/apt-arrival-cast-probe-20261114.md` und `…-retry-20261114.md`. Der Planer
hält sich an die Vorgabe (Pick-up + Lagerleiter, Van + Planerin + Fahrer, Pkw für die Reporterin);
der größere Van stand zuerst zu nah am Hangar und landete nach der produktiven Korrekturrunde auf dem
Vorfeld.

**Schritt 4, Fracht-Stränge (umgesetzt, Web v2394):** Gemeinsamer Prompt-Baustein und Prüfung in
`mission-onboard-core.js` (`GROUND_CAST_PROMPT`, `groundCastFrom`: je Szene 0–2 Personen mit Rolle und
Geschlecht, Ungültiges fällt still auf die Standardperson zurück, die Idee scheitert nie daran). Fracht,
zerbrechliche Fracht und Tiertransport liefern `groundCast` (Anlieferer am Start, Empfänger am Ziel;
Kurier bzw. Begleitperson ist Pax, nicht Teil von groundCast). Live-Probe:
`analysis/ground-composer-cast-cargo-20261114.md`, `…-cast-courier-20261114.md` – Rollen passen zu
Absender/Empfänger, nach dem Hinweis gegen Berufsklischees gemischte Geschlechter.

**Offene Besetzung aus der Geschichte (umgesetzt, Web v2395, User-Entscheidung 14.11.2026):** Nennt eine
Mission ihre Bodenpersonen nicht selbst (Bush über den V4-Writer, Training, alle Stränge ohne
`groundCast`), bekommt der Composer `personen: "offen"` und legt aus Anlass/Geschichte 1–2 Personen je
Szene fest (Rolle, Geschlecht, Look; `castSource: 'story'`, gilt wie feste Besetzung). Die Platzregel
kürzt auf das, was ins Fahrzeug passt. Kein Eingriff in den Bush-Writer. Jede Szene nennt dem Composer
ihren Ort (`places` aus Idee-Route bzw. Bush `homeRef`/`targetRef`); Rückkehr-Missionen
(`bush.requiresReturnHome`) enden am Abflugplatz – dort holt die Start-Szene ab, und das Aussteigen
nimmt deren Fahrzeug (`_missionSceneDeboardingComposerScene`). Live-Probe Bush 6 Profile:
`analysis/ground-composer-cast-places-bush*-20261114.md` – namentliche Figuren aus der Geschichte
(Ranger Ben + Mechaniker), Werft am Heimatplatz, Techniker am Strip (ohne Ortsangabe vorher vertauscht).

**Langfrist-Entscheidung (User, 14.11.2026):** Alle Missionen liefern ihre Bodenpersonen selbst
(`groundCast`); die Besetzung aus der Geschichte ist nur der erste Rückfall, die Standardperson der
zweite. Reihenfolge: `castSource` idea → story → default. Bush-Writer erst, wenn er ohnehin umgebaut wird.

**Charter und Reporter (umgesetzt, Web v2396):** Beide Ideen liefern `groundCast` (Charter: wer die
Reisenden bringt und wer abholt; Reporter: wer bringt, wer am Ziel empfängt), der Writer bekommt
`GROUND_CAST_WRITER_RULE` (dieselben Personen, keine erfundenen Empfänger). Rückreisen
(`mission-charter-continuation-core.js` `mirrorGround`) tauschen Start und Ziel für `groundCast` und
die gespeicherten Composer-Szenen: wer am Ziel empfangen hat, bringt jetzt zurück. Fest leere
Start-Besetzung (Reporter kommt allein): das Startfahrzeug bleibt geparkt stehen
(`_missionSceneStartVehicleStays`). Beide Ideen-Prompts verlangen jetzt ausdrücklich deutsche Texte (ein
Probeabruf kam ohne diese Vorgabe auf Englisch). Live-Probe: `analysis/ground-composer-cast-charter-news*-20261114.md`.

**Sightseeing, Verein, Medizin, Privat (umgesetzt, Web v2397):** Alle Ideen-Stränge liefern jetzt
`groundCast` mit Writer-Regel; Sightseeing und Medizin verlangen zusätzlich deutsche Texte. Privat-Rückflug
(`mission-private-return-core.js`) spiegelt `groundCast` und Composer-Szenen wie die Charter-Fortsetzung.
Der Krankenwagen ist beim Patiententransfer an beiden Enden erlaubt (4 Plätze). Live-Proben:
`analysis/ground-composer-cast-{club,medical,privateCast}-20261114.md`, `analysis/sightseeing-groundcast-20261114.json`.
Damit liefern alle Ideen-Stränge ihre Bodenpersonen; Bush, Training, SAR, Feuer und POI-Briefings laufen
über die Besetzung aus der Geschichte.

**Empfänger steigen mit ein (umgesetzt, Web v2398):** Die Zielszene (`_missionAptArrivalSceneItems`) markiert
mit Composer-Plan jede verbliebene Empfangsperson (`arrival_person_*`, höchstens 45 m vom Abholfahrzeug) als
`departWithPickupVehicle`. Der Tracker (`planPickupReception`, seit v634 vorhanden, bisher nur beim Medien-Empfang
genutzt) lässt sie nach dem Aussteigen der Pax zum Fahrzeug gehen, entfernt sie dort und schickt das Fahrzeug erst
danach los. Die Figur wird dafür schon als laufende Person gewählt. Kein Tracker-Build nötig. Ausgenommen: die
wartende Bush-Abholperson (ist selbst der Pax) und Szenen ohne Composer-Plan (unverändert).

**Offen:** Tracker-Log zeigt die Szenen ab dem nächsten Build (`GROUND_COMPOSER … scenes=`).

### Etappe F – Aufräumen

- Regex-Geschlechtserkennung in `_missionScenePassengerGender` entfernen.
- Stichwort-Zuordnung `_missionSceneSemanticCargoAsset` und Textrückfall in
  `mission-cargo-visual-core.js` entfernen, sobald alle Stränge umgestellt sind.
- Testschalter einzeln entfernen, Doku (`mission-scene-asset-strategy.md`,
  `Mission Building Instructions.md`, `Mission Flow Reference.md`) nachziehen.

## 3a. Stand Etappe A (12.11.2026)

Umgesetzt hinter dem Testschalter `ga_person_figures_v1` (bis 14.11.2026 Standard aus, seitdem für alle an – siehe „Für alle eingeschaltet“).
Einschalten: Einstellungen → Boarding Szene → „Figuren (Test)“, oder per Adresszeile
`?personFigures=on` (`off` schaltet aus), oder `localStorage.setItem('ga_person_figures_v1','on')`:

- A1 `tools/generate-mission-person-assets.mjs` → `data/mission-person-assets.js`
  (Pack-Figuren mit `person`-Block + Tarmac-Stock aus `data/mission-person-asset-profiles.json`,
  `packFallbacks` für Pack-Figuren ohne `appearance`). Teil von `release-homebase-pack.mjs`.
- A2 `_missionSceneIsPersonFigureTitle` statt `/^tarmac_/` (Manifest-Manual-Pax, Kandidaten,
  Ankunftspersonen).
- A3 `mission-person-figure-core.js`: `pickPersonFigure`, `pickGroupFigures`,
  `seasonFromContext`, feste Liste `defaultLookForRole` (Test prüft Vollständigkeit).
- A4 `mission-onboard-core.js`: Bordliste für `charter-idea.v1`, `sightseeing-idea.v1`,
  `apt-news-idea.v1`, Rückfall `fromPassenger`.
- A5 `mission-ground-visual-core.js`: ein Abruf für Looks + Packstücke, schreibt
  `groundVisual` und `cargoVisual`; Rückflug behält Looks (`paxSignature`); Ausfall →
  feste Liste + bisheriger Cargo-Composer. Eingebunden in die drei Browser-Adapter.
- A6 `_missionSceneGroundFigures` in `sync.js`: Figur je Pax beim Einsteigen (einzeln und
  Gruppe), Aussteigen (Kandidaten in Pax-Reihenfolge) und im Manifest (`visualPersons`).
- A7 `tracker.js` `personWalkSpeedKts`: Tempo je Figur auf `maxWalkKts`, Laufzeiten nach
  der langsamsten Figur (Einsteigen, Aussteigen, Empfang, Besucher, Fahrzeugpersonal).

Offen: Sim-Test mit Schalter; danach Etappe B (Live-Proben der Pilot-Stränge).

## 4. Checkliste je Strang (beim Umbau abhaken)

- [ ] Bordliste aus der Idee bzw. dem Profil korrekt (Pax, Anzahl, Cargo-Posten)
- [ ] Composer bekommt Anlass/Aufgabe; Ergebnis gültig in Live-Proben
- [ ] Rückfall ohne KI liefert plausible Looks
- [ ] Figur je Pax beim Einsteigen, Aussteigen, ggf. Abholung und Rückflug identisch
- [ ] Geschlecht Figur = Stimme; Saison passt
- [ ] Gepäckstücke wie bisher (`visualPieces`), Gewicht unverändert
- [ ] Wiederherstellung nach Reconnect/Neustart zeigt dieselben Figuren
- [ ] Testschalter, Unit-Test, Sim-Test protokolliert

## 5. Entscheidungen des Users (12.11.2026)

1. Look-Liste bleibt voraussichtlich; Feinschliff siehe Vorschlag unten.
2. Gruppen bleiben bei höchstens 5 Pax (mit Pilot 6 Personen); keine Änderung an Gruppen-Kern und Kapazität.
3. Patient ist gehfähig und läuft als Pax-Figur; eine eigene Patientenfigur kann folgen.
4. Ohne KI-Modus: nur Auswahl aus einer festen Liste, kein Composer-Abruf.
5. Zusatz: Die Wanderin darf auch als Zuschauerin bzw. Abholerin/Bringerin in passenden
   Bereichen erscheinen (Etappe E).

Wortliste v2 freigegeben (12.11.2026): `uniform` aufgeteilt in `medical` und
`fire_rescue`; neue Einsatzwerte `patient` und `escort` (bringt oder holt jemanden ab).
Die Wanderin bekommt im nächsten Pack zusätzlich `escort`.
