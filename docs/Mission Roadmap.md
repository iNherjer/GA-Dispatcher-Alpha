# Mission Roadmap

Aktuelle APT-/POI-Restliste (04.10.2026): [Bestandsaufnahme der Modernisierung](Mission%20Sets%20Handoff.md#bestandsaufnahme-der-apt-poi-modernisierung-04102026). Tiertransport wird mit Alpha v1910 veröffentlicht; als Nächstes folgen Medizin-Transfer und Reporter; SAR Heli bleibt deaktiviert und kommt auf Nutzerwunsch zuletzt. Ältere Prioritätslisten unten gelten nicht als aktueller Release-Status.


## Aktuelle Arbeitsreihenfolge – 04.10.2026

1. **APT Tiertransport:** eigener Ideen-/Briefing-/History-Pfad, konsistente Tierbegleitung, Sendung und Übergabe; Release Alpha v1910.
2. **APT Medizin-Transfer:** eigener Personal-/Material-/Patientenverlegungs-Ideenpfad im Alpha-Release Web v1916 / Tracker v471 (05.10.2026). Drei finale Gemini-Proben und Arrival-Projektion bestanden; MSFS-/Voice-Feldabnahme offen.
3. **APT Reporter:** Alpha Web v1918 / Tracker v472 (05.10.2026), `apt-news-v1.6`. Eigene Ideen-, Writer- und History-Pipeline für seriöse und kuriose journalistische Bodenaufträge. Ein Reporter mit persönlicher Ausrüstung, geplanter Abholung und optionalem Rückauftrag nach bestätigter Ankunft. Zwei finale Gemini-Hin-/Rückflugproben inklusive acht Routenansagen bestanden; 139 Regressionstests sowie gepackter Tracker-Missionsprozess geprüft. MSFS-/Audio-Feldabnahme offen.
4. Abschlussprüfung einschließlich Fortsetzungen, Rückflügen, Tracker/EFB und Voice.
5. SAR Heli bleibt deaktiviert; vollständiges Rewrite zuletzt.

### Verbindliche Qualität für Folgeaufträge und Rückflüge

Diese Prüfung gehört zu jeder Familienmigration, nicht erst zur Abschlussrunde:

- Dieselben Personen, Tiere, Sendungen und vereinbarten Rollen weiterführen. Am Ziel ausgeladene Tiere/Fracht nicht automatisch wieder an Bord nehmen.
- Nur bestätigte Runtime-Ergebnisse als geschehen erzählen. Entwürfe und History sind keine geflogenen Ereignisse. Teilbefund, Abbruch und fehlgeschlagene Übergabe bleiben ausdrücklich unterscheidbar.
- Die neue Aufgabe muss aus dem vorherigen Anlass oder Ergebnis entstehen. Rückfluggrund, mitreisende Personen und tatsächliche Rückladung explizit definieren; keine neu ausgeloste Erstmission als Fortsetzung.
- Gleiche Briefingqualität wie beim Hinflug: klare Perspektive, belegte Flug-/Wetterdaten, natürliche Begrüßung, passende Voice und konsistente Arrival-Rollen. Geplante Betreuung am Boden nicht als abgeschlossen behaupten.
- Handoff, Speicher/Restore und Cloud-Kompaktierung müssen Identitäten und Kontinuitätsdaten erhalten. Wiederherstellung darf keinen zweiten Folgeauftrag erzeugen.
- Pro Profil Erstauftrag und vorhandene Folge-/Rückflugpfade prüfen, einschließlich Erfolg, Teilerfolg und Abbruch. Nicht implementierte Anschlusslogik bleibt als offen dokumentiert.

Tiertransport-Erstauftrag lokal umgesetzt: strukturierte Idee, eigener Writer, begrenzte History, Angebotsauswahl, persistente Identitäten und geplanter Empfangskontakt. 26 gezielte Tests plus Cargo-Szenentest grün (Idee/Annahme/Restore/Wetter/Arrival plus fragile Fracht und Tier-Assets). Live-Gemini-Proben am 04./05.10. durchgeführt; Prompt V1.7 trennt Anlass, Handhabung und noch bevorstehende Verladung; der Writer formuliert kurze aktive Sätze und bindet die Begrüßung ausdrücklich an die Sprechrolle des Begleiters. Die Sprachprobe vom 05.10. wurde mit derselben fiktiven Sendung wiederholt. greeting erklingt nach dem Einsteigen und darf deshalb nicht zum Verladen auffordern oder einen ungeprüften Sicherungsstatus behaupten. Die letzte Probe hält Identitäten und Verpackung konsistent. Szene/Manifest lokal geprüft; echte Voice-Audio- und Simulatorabnahme stehen noch aus. Eigene Tiertransport-Fortsetzungen werden dadurch noch nicht als fertig gewertet.

Diese Datei ist die praktische Ausbau- und Backlog-Liste fuer neue Missionsfamilien.

Sie ergaenzt das Kochbuch in `Mission Building Instructions.md`:

- Das **Kochbuch** beschreibt, wie Missionen gebaut werden muessen.
- Diese **Roadmap** beschreibt, was als Naechstes gebaut, erweitert oder vereinheitlicht werden soll.

Wichtige Regel:

- Neue Missionen werden **nicht** frei erfunden.
- Jede neue Idee wird zuerst einer bestehenden **Grundform** und einem bestehenden **Rezept** zugeordnet.
- Erst wenn Story- oder Textvarianten nicht mehr reichen, entsteht ein neues Profil.

## 1. Aktueller Stand

### 1.1 Bereits umgesetzte Bush-Profile

| Profil | Grundform | Rezeptbasis | Status |
| --- | --- | --- | --- |
| `bush_supply_strip` | `A -> B` | Bush strip target | umgesetzt |
| `bush_charter_strip` | `A -> B` | Bush strip target | umgesetzt |
| `bush_scenic_hopper` | `A -> B` | Bush strip target | umgesetzt |
| `bush_pickup_strip` | `A -> B (mit Landung) -> A` | Bush pickup return | umgesetzt |
| `bush_pickup_cargo` | `A -> B (mit Landung) -> A` | Bush pickup return | umgesetzt |
| `bush_recon_return` | `A -> B (Task ohne Landung) -> A` | POI on-task return | umgesetzt |

### 1.2 Bereits umgesetzte Grundformen

| Grundform | Beschreibung | Referenzen |
| --- | --- | --- |
| `A -> B` | Abschluss am Zielflugplatz | APT-Zielmissionen, Bush Supply, Bush Charter, Bush Scenic |
| `A -> B (mit Landung) -> A` | Zwischenlandung mit Bodenauftrag, danach Heimkehr | Bush Pickup Passenger, Bush Pickup Cargo |
| `A -> B (Task ohne Landung) -> A` | Ziel ist Arbeitsraum, nicht Endflugplatz | POI on-task, Bush Recon Return |

## 2. Bush-Roadmap

### 2.1 Hohe Prioritaet: neue Bush-Profile

Diese Ideen sind fachlich klar genug, dass daraus bei Bedarf eigene auswählbare Bush-Profile entstehen koennen.

#### 2.1.1 Bush Fire Watch RTB

- Grundform: `A -> B (Task ohne Landung) -> A`
- Rezeptbasis: `POI on-task return`
- Profiltyp: Bush-Air-Task
- Warum eigenes Profil:
  - klar eigene Sprache und Einsatzlogik
  - Rauch / Hotspot / Sichtbedingungen als zentrales Narrativ
  - nicht nur ein normaler Strip-Check
- Erwartete Inhalte:
  - Rauchfahnen, Brandnester, Glutstellen, trockene Hanglagen
  - Beobachtung statt Landung
  - klarer Rueckflug nach Abschluss

#### 2.1.2 Bush SAR / Search RTB

- Grundform: `A -> B (Task ohne Landung) -> A`
- Rezeptbasis: `POI on-task return`
- Profiltyp: Bush-Air-Task
- Warum eigenes Profil:
  - klare Suchsprache, strukturierte Sektoren, Lagebild
  - eigene Voice-Familie fuer Sichtkontakte, Suchmuster, Abschluss
  - darf nicht in normales Recon-Wording zurueckfallen
- Erwartete Inhalte:
  - vermisste Person, Rauch-/Spiegel-/Fahrzeughinweis, Notlager, Rettungsinsel
  - Wildnis- und Tal-/Flussbezug
  - Rueckflug nach Abschluss oder Freigabe

#### 2.1.3 Bush Wildlife Survey RTB

- Grundform: `A -> B (Task ohne Landung) -> A`
- Rezeptbasis: `POI on-task return`
- Profiltyp: Bush-Air-Task
- Warum eigenes Profil:
  - fachlich kein Technik-Check, sondern Beobachtungsflug
  - kann sehr abwechslungsreiche Bush-Geschichten erzeugen
- Erwartete Inhalte:
  - Wildtierzaehlung, Herdentracking, Brutplatz-Check, Habitat-Beobachtung
  - ruhige Kreise, Arbeitshoehe, mehr Beobachtungs- als Strip-Sprache

#### 2.1.4 Bush Geo / Damage Recon RTB

- Grundform: `A -> B (Task ohne Landung) -> A`
- Rezeptbasis: `POI on-task return`
- Profiltyp: Bush-Air-Task
- Warum eigenes Profil:
  - Gelände- und Naturschaden statt Betriebsflaechenfokus
  - logisch eigenstaendige Recon-Familie
- Erwartete Inhalte:
  - Hangrutsch, Erosion, Uferabbrueche, Drainage, Flutschaden, Zufahrtsproblem
  - Wildernis-/Gebirgs-/Talbezug

### 2.2 Mittlere Prioritaet: Themenfamilien auf bestehenden Bush-Profilen

Diese Ideen brauchen wahrscheinlich **noch kein neues Profil**, sondern zunaechst nur neue Story-/Persona-/Prompt-Familien auf bestehenden Rezepten.

#### 2.2.1 Bush Medical / Utility Dropoff

- Grundform: `A -> B`
- Aktuelle Basis: `bush_supply_strip` oder `bush_charter_strip`
- Mögliche Themen:
  - Medkits, Blutkonserven ohne SAR-Drama
  - Techniker-Transfer
  - Ranger-Ablösung
  - Funk-/Strom-/Pumpenversorgung

#### 2.2.2 Bush Camp / Lodge / Field Visit

- Grundform: `A -> B`
- Aktuelle Basis: `bush_charter_strip` oder `bush_scenic_hopper`
- Mögliche Themen:
  - Lodge-Gast
  - Jagd-/Angelcamp
  - Fotograf oder Forscher am Zielstrip absetzen
  - Saisonarbeiter oder Crew-Shuttle

#### 2.2.3 Bush Cargo Retrieval Specials

- Grundform: `A -> B (mit Landung) -> A`
- Aktuelle Basis: `bush_pickup_cargo`
- Mögliche Themen:
  - Proben rueckholen
  - defekte Ausruestung bergen
  - Sensorik / Funkakkus / Werkzeuge einsammeln
  - Betriebsunterlagen / Kisten / Ersatzteile heimholen

### 2.3 Niedrige Prioritaet: spätere Spezialisierungen

Diese Ideen sind brauchbar, aber erst sinnvoll, wenn die Hauptfamilien stabil und ausreichend abwechslungsreich sind.

- Bush Angler / Hunter logistics
- Bush seasonal worker rotation
- Bush remote construction support
- Bush river corridor monitoring
- Bush weather station maintenance
- Bush trail / bridge access check

## 3. POI-Roadmap

Die POI-Familie ist strukturell schon gut aufgestellt. Der Schwerpunkt liegt hier eher auf Themen- und Rollenvielfalt als auf neuen Ablaufprofilen.

### 3.1 Naechste sinnvolle Erweiterungen

- mehr gute `inspection_infra`-Varianten mit klar unterscheidbaren Ergebnissen
- mehr `science_bio` / `science_geo` / `mapping_survey`-Personas
- mehr bush-nahe POI-Storys fuer `bush_recon_return`
- bessere Ergebnistexte fuer fertige Aufgaben:
  - Was wurde gesehen?
  - Wie schwer ist der Schaden?
  - Ist Nacharbeit noetig?
  - Ist sofortiger Handlungsbedarf da?

### 3.2 Sonderfamilien weiter schaerfen

- `fire_watch`
- `search_and_rescue`
- `training`

Ziel:

- keine neuen Runtime-Sonderpfade, sondern klarere Inhalte, Voice-Regeln und Missionsziele

## 4. APT-Roadmap

### Vereins-/Utility-Erweiterung: menschlicher Anlass (Anforderung 15.09.2026)

Vertrag, Picker und aktueller Implementierungs-/Teststand: [Vereins-/Utility-Ideen V1](Mission%20Club%20Utility%20Ideas%20V1.md). Lokal implementiert; Veröffentlichung steht aus.

- Ergänzung: Regionale Fly-ins/Flugfeste vor der endgültigen Auswahl der drei Picker-Ziele suchen. Bei geeignetem belegtem Termin einen der drei Vorschläge darauf ausrichten; ohne Treffer drei normale Ideen. Größere Suchregion zulassen, bestehende Routen-/Flugzeuggrenzen erhalten.
- Präzisierung: Der außen gelandete Segelflugpilot gelangt per Fahrzeug zum Abflugplatz. In dieser Arbeit keinen Pickup vorbereiten; der angebotene Flug beginnt mit regulärem Boarding am Flugplatz.

- Zielbild: freie Ideen innerhalb des Vereinslebens und der gegenseitigen fliegerischen Hilfe. Menschen, gemeinsame Interessen und Teilnahme dürfen den Anlass tragen; bestehende Lieferaufträge bleiben gleichwertig möglich. Nutzereingebrachte Situationen sind Anforderungen an den Spielraum, kein verpflichtender Beispielkatalog im Prompt.
- Ideen zuerst entwickeln; daraus Passenger, persönliches Gepäck, tatsächliche Lieferladung und nächsten Schritt am Boden ableiten. Gepäck-Stichwörter sollen nicht die Geschichte auswählen. Akzeptierte KI-Ideen und Texte nicht nachträglich auf feste Vereins-Textbausteine umbiegen.
- Reale Fly-in-/Flugfest-Termine nur mit passendem Datums-, Orts- und Quellenbeleg verwenden. Private Verabredungen dürfen plausibel erfunden sein; sie sind keine recherchierten öffentlichen Veranstaltungen.
- Personenhilfe ist auch ohne Fracht möglich: Ein bereits am Abflugplatz aufgenommener Segelflugpilot kann als A-B-Passagier zu seinem ursprünglichen Startplatz gebracht werden, wo Auto und Anhänger für die anschließende Rückholung seines Segelflugzeugs stehen. Die Autofahrt und Flugzeugrückholung sind erzählter Anschluss, keine simulierten Missionsziele. Außenlandefeld-Pickup ist damit nicht implementiert.
- **Backlog, noch nicht definiert:** APT Vereins-/Utility-Gegenstands-Pickup. Vor Implementierung Ladeort, Hin-/Rückflug, Manifest, Abschlussbedingungen und Verhältnis zu bestehenden Pickup-Rezepten festlegen. Bis dahin keine Abholung als ausführbare Mission anbieten.
- Für die spätere Umsetzung kompakte KI-verfasste History zu Anlass, Beziehung, Interessen und Erzählweise vorsehen; erzeugte Ideen nicht als tatsächlich geflogene Erlebnisse behandeln. Vorhandene Auswahlhistorie berücksichtigen.
- Analysebefund: Der aktuelle `club_utility`-Pfad enthält bereits Besuche, leitet aber Seed/Persona und Storyframe aus Cargo-/Textheuristiken ab und kann Writer-Prosa durch `_missionPipelineV4ComposeClubUtilityStory` ersetzen. Gezielte Migration dieses Profils planen; gemeinsame Klassifikation, andere Missionstypen und Gruppenlogik separat beurteilen. Diese Notiz ändert noch keine Laufzeitlogik.

APT-Missionen sind bereits breit angelegt. Hier geht es eher um Konsistenz und mehr gute Missionsgeschichten.

Naechste sinnvolle Arbeit:

- APT-Dropoff-/Unload-/Handoff-Texte weiter harmonisieren
- mehr gute Bodenkontakt-/Empfangsrollen
- gleiche End- und Farewell-Qualitaet ueber Cargo, Passenger und Utility hinweg

## 5. Priorisierte Arbeitsreihenfolge

### Phase 1

1. Bush Fire Watch RTB
2. Bush SAR RTB
3. Bush Wildlife Survey RTB
4. Bush Geo / Damage Recon RTB

### Phase 2

1. Bush Medical / Utility Dropoff Themenfamilie
2. Bush Camp / Lodge / Field Visit Themenfamilie
3. Bush Cargo Retrieval Specials

### Phase 3

1. weitere APT-/POI-Persona- und Story-Pools
2. Ergebnis-/Abschluss-Texte systematisch verbessern
3. spaetere Spezialprofile nur dann anlegen, wenn Story-Varianten nicht mehr reichen

## 6. Entscheidungsregel fuer neue Ideen

Wenn eine neue Bush-Idee aufkommt, immer in dieser Reihenfolge entscheiden:

1. Welche **Grundform** ist das?
2. Welches **bestehende Rezept** passt dazu?
3. Reicht ein neues **Theme / Persona / Prompt-Set**?
4. Nur wenn das nicht reicht: braucht es ein **neues Profil**?

## 7. Offene Fragen

Diese Punkte muessen wir bei der Umsetzung neuer Roadmap-Ideen jeweils bewusst entscheiden:

- Braucht die Idee wirklich ein neues auswählbares Profil?
- Oder reicht eine neue Themenfamilie auf einem bestehenden Profil?
- Soll die Mission landungsbasiert sein oder als reiner Luftauftrag laufen?
- Gibt es fuer diese Idee schon ein gutes Referenzrezept in POI oder APT?
- Welche Voice-Perspektive ist am besten:
  - Passagier an Bord
  - Empfaenger am Ziel
  - Dispatcher / Instruktor / Ranger / Beobachter
