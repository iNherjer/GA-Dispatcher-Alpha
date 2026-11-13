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

### Etappe F – Aufräumen

- Regex-Geschlechtserkennung in `_missionScenePassengerGender` entfernen.
- Stichwort-Zuordnung `_missionSceneSemanticCargoAsset` und Textrückfall in
  `mission-cargo-visual-core.js` entfernen, sobald alle Stränge umgestellt sind.
- Testschalter einzeln entfernen, Doku (`mission-scene-asset-strategy.md`,
  `Mission Building Instructions.md`, `Mission Flow Reference.md`) nachziehen.

## 3a. Stand Etappe A (12.11.2026)

Umgesetzt hinter dem Testschalter `ga_person_figures_v1` (Standard aus, gilt je Gerät).
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
