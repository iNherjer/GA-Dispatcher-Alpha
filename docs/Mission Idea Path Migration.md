# Umbau der Missionsarten auf den Ideen-Weg – Klärungsstand

Stand 18.11.2026 (Basis `15277d796`, Klärung auf `e11087954`). Plan freigegeben (Abschnitt 6), noch nichts umgebaut. Anlass ist Phase 4 der
englischen Übersetzung (`docs/English Translation Plan.md`), die Entscheidung soll in einer eigenen
Sitzung fallen.

## 1. Worum es geht

Die Missionserzeugung hat heute zwei Bauarten:

- **Ideen-Weg:** Ein Ideen-Kern lässt Gemini strukturierte Vorschläge als JSON planen
  (`*-idea.v1`, `*-proposal.v1`), prüft Felder, Fakten-IDs und Verträge und baut daraus Briefing,
  Ladung, Passagiere und Szene. Der Text ist Ergebnis, nicht Datenquelle.
- **Alte Pipeline (V4-Planner + V5-Writer):** `_missionPipelineV4*` und `_missionWriterV5*` in
  `app.js`. Der Writer schreibt Fließtext; viele Prüfungen und Folgeschritte lesen diesen Text
  mit deutschen Mustern aus.

Für die Übersetzung ist das der entscheidende Unterschied (Abschnitt 4): Missionsarten auf dem
Ideen-Weg können direkt auf Englisch schreiben, die alte Pipeline nicht ohne zweisprachige Prüfungen.

## 2. Bestand

### Schon auf dem Ideen-Weg

| Bereich | Kerne / Schemata | Doku |
|---|---|---|
| APT Charter | `mission-charter-ideas-core.js`, `charter-idea.v1` | `Mission Charter Ideas V1.md` |
| APT Besichtigung | `mission-sightseeing-ideas-core.js`, `sightseeing-idea.v1` | `Mission Sightseeing Visits V1.md` |
| APT Reporter | `mission-apt-news-ideas-core.js`, `apt-news-idea.v1` | `POI Reporter Briefing Migration.md` |
| APT Medizin-Transfer | `mission-medical-transfer-ideas-core.js`, `medical-transfer-idea.v1` | Roadmap |
| APT Verein/Utility | `mission-club-ideas-core.js`, `club-idea.v1` | `Mission Club Utility Ideas V1.md` |
| APT Fracht, zerbrechliche Fracht, Tiertransport | `mission-cargo-ideas-core.js`, `mission-fragile-cargo-ideas-core.js`, `mission-animal-transport-ideas-core.js` | `Mission Cargo Ideas V1.md`, `Mission Fragile Cargo Ideas V1.md` |
| Privat | `mission-private-episode-v6.js` (`private-proposal.v1`), `mission-private-outing-core.js`, `mission-private-return-core.js` | `Mission Episode Writer V6.md` |
| POI-Briefings | `sar-proposal.v2`, `infra-proposal.v1`, `mapping-proposal.v1`, `knowledge-proposal.v1`, `geo-proposal.v1`, `poi-photo-proposal.v1`, `news-proposal.v1` (Briefing-Kerne `mission-*-briefing-browser.js`) | `POI Shared Briefing Guide.md` u. a. |

Gemessen (AST-Zählung, Regex mit deutschen Wörtern): die Ideen-Kerne haben **0–1** solcher
Prüfungen je Datei. Deutsch ist dort nur die Sprachvorgabe im Prompt.

### Noch alte Pipeline

- **Bush, alle sechs Profile** (Versorgung, Charter, Abenteuer, Personen-/Frachtabholung,
  Erkundung): V4-Planner + V5-Writer. Laut `Mission Semantics Rules V4.md` lösen die alten
  semantischen Prosaheuristiken dort **nur noch Diagnose** aus, keinen Ersatztext. Struktur-,
  Vertrags-, Szenen- und Laufzeitprüfungen bleiben.
- **Übrige Legacy-APT-/POI-Pfade**, für die die Ausnahme nicht gilt (genaue Liste offen, siehe 5).

Deutsche Textmuster in `app.js` nach Funktionsgruppe: `_missionPipelineV4*` 162,
`_missionWriterV5*` 127, `_storyAlreadyCoversProfileCue` 21, `_poi*` 17, Privat-Ausflug-Helfer
~40, `missionMatchesTaskProfile` 12, `_deriveTaskDomain` 6 (Rest kleiner). Gesamt in den
Missionsdateien gut 830, davon rund 130 in Qualitätsprüfungen (`NeedsRepair`, `Looks…`,
`sanitize…`). Seit dem 05.11. kaum gesunken.

## 3. Wo der deutsche Text nach dem Schreiben weiterverwendet wird

Diese Stellen müssen bei einem Umbau auf strukturierte Felder umziehen (oder zweisprachig werden):

- Fracht-SimObject-Auswahl aus dem Frachttext (`sync.js` um `pickPrimary`, ~Z. 7198)
- SAR-Erkennung „vermisste Person …“ (`sync.js` ~Z. 8785, `_missionSarLooksLikePersonSearch`)
- `_missionTargetSceneKind` mischt `taskDomain` mit Text (`sync.js`)
- Infrastruktur-Ergebnisklassen (`mission-infra-outcome-core.js`)
- Rückfall-Klassifizierer `_deriveTaskDomain`, `_deriveRoleProfileFromRole` (nur ohne Felder)
- Fracht-Auswahl aus Story (`_pickPrivateOutingCargo`, `_pickClubUtilityCargo`,
  `_pickCargoFragileCargoFromStory`, `_animalTransportCargoSignalFromText`)
- Passagierstimme: `_isLandingPhaseEvent` / Trainings-Erkennung lesen den gesprochenen Satz
  (`passenger-voice.js`), Erzählgedächtnis nutzt deutsche Ereignistitel als Schlüssel (bleibt, siehe
  Übersetzungsplan 2.10)

## 4. Bezug zur Übersetzung (Phase 4)

| Weg | Englisch bei Bedarf | Mehrkosten |
|---|---|---|
| Ideen-Weg | Writer schreibt direkt Englisch (Sprachparameter im Prompt), Prüfungen bleiben strukturell | ~0 (kein Zusatzaufruf); feste deutsche Rückfallsätze brauchen englische Fassung |
| Alte Pipeline | Deutsch erzeugen und prüfen, Englisch nachreichen (Variante C) | ein Übersetzungsaufruf je Mission |
| Schon erstellte Missionen | Übersetzung bei Bedarf, Ergebnis gespeichert | einmalig je Mission |

Kostenschätzung aus dem Messlauf einer kompletten Bush-Mission (Oktober,
`analysis/gemini-parameter-migration/full-bush-release.json`): 8 Aufrufe, ~48.000 Eingabe-,
~4.000 Text- und ~6.500 Denk-Tokens. Eine Übersetzung kostet ~2.000–4.500 Eingabe- und etwa gleich
viele Ausgabe-Tokens ohne Denken: grob +25–35 % je Mission mit demselben Modell, +5–10 % mit einem
kleinen Modell (Flash-Lite). Nur bei englischer Oberfläche. Schätzung, Preise nicht nachgemessen.

Jeder Missionsart, die auf den Ideen-Weg wechselt, kann danach ohne Zusatzaufruf englisch schreiben.

## 5. In der eigenen Sitzung zu klären (beantwortet in Abschnitt 6)

1. **Vollständige Liste:** Welche Missionsarten/Profile laufen produktiv noch über V4/V5 (Bush
   sicher; welche APT-/POI-Pfade noch)? Dispatch-Routing in `app.js` nachverfolgen.
2. **Bush direkt englisch?** Da die Prosaheuristiken bei Bush nur noch diagnostisch sind: Reicht es,
   die Folgeschritte aus Abschnitt 3 auf Felder umzustellen, damit der V5-Writer direkt Englisch
   schreiben darf – oder soll Bush komplett auf einen Ideen-Kern (`bush-idea.v1`) wechseln?
3. **Zielbild und Reihenfolge:** Welche Art zuerst (Vorschlag: die mit den meisten Textfolge-
   schritten zuletzt; Bush vor SAR/Infrastruktur, weil die Prüfungen dort schon entschärft sind).
4. **Was bleibt Legacy?** Sim-Modus-Pfad (`docs/Mission Runtime Authority Contract.md`, Web-Laufzeit
   ist Legacy) nicht mit umbauen.
5. **Freigabe:** Änderungen an Klassifizierung, Parsern, Regex-Heuristiken und Contracts betreffen
   mehrere Missionsarten → laut `AGENTS.md` erst Problem/Ursache/Impact nennen, Freigabe abwarten.
6. **Messung:** Vor dem Umbau je Missionsart Aufrufe und Tokens neu messen
   (`tools/gemini-mission-release-live.mjs` o. ä.), damit der Kostenvergleich auf aktuellem Stand ist.

Pflichtlektüre für die Sitzung: `docs/Mission Flow Reference.md`, `docs/Mission Building
Instructions.md`, `docs/Mission Semantics Rules V4.md`, `docs/Mission Roadmap.md`, dieses Dokument.

## 6. Ergebnis der Klärung (18.11.2026)

Basis `e11087954`. Nur Analyse, kein Code geändert. Der User hat den Plan in 6.4 freigegeben; jeder
Code-Schritt braucht eine eigene Freigabe.

### 6.1 Vollständige Liste: was produktiv noch alt läuft (KI an)

Routing in `generateMission` (`app.js`, Weichen `use…Ideas` ~Z. 45883–45940): Nur wenn keine
Ideen-Weiche greift, laufen `fetchMissionPlannerV4` und danach `fetchMissionWriterV5`.

**V4-Planer + V5-Writer (allgemeiner Writer-Pfad):**

1. **Bush, alle sechs Profile**, einschließlich Bush-Folgeflüge (Pickup-Rückflug, Supply-/Charter-
   Folge über `mission-followup.js`). Eigener Zweig `writer_v5_bush` (~Z. 46176).
2. **Charter-Rückflug `apt_charter_pickup` alter Missionen ohne `charterIdea`**
   (`MissionLegacyCharterNarrativeCore`). Läuft aus, sobald alte Charter abgeflogen sind.
3. **POI-Folgeaufträge ohne Fortsetzungs-Kern**: Alle heutigen POI-Folgeaufträge stammen aus der
   Infrastruktur-Kette (`infra_recheck`/`infra_final_review` → Inspektion, `infra_repair_photo` →
   Foto, `infra_damage_mapping` → Mapping) und sind abgedeckt. Auf V4/V5 fällt nur ein alter
   Folgeauftrag ohne POI-Zielbezug (`MissionPoiFollowupNarrativeCore.context` liefert `null`).

Ideen-Missionen sind von den alten Text-Profilprüfungen ausgenommen (`missionMatchesTaskProfile`
erkennt sie über ihr Schema). Für Englisch bleiben bei APT/POI nur die gemeinsamen Folgeschritte
aus Abschnitt 3, die auch Ideen-Missionen betreffen (Fracht-SimObject, SAR-Erkennung,
Szenen-Art, Infrastruktur-Ergebnis, Ankunfts-Hinweis, Voice-Landeerkennung).
4. **Rückfälle**: `infra_chain_recon` ohne `dest.poiChain`; ein Ideen-Kern per Testschalter
   (`ga_*_briefing_v1 = off`) abgeschaltet; V4-Planer scheitert → V2-Planer, Writer bleibt V5.

**V4-Planer, aber eigener Writer:**

5. **Training APT/POI (`trn`)**: `fetchMissionWriterV5` leitet sofort an `fetchTrainingNarrative`
   weiter (`training-narrative.v1`, eigenes JSON, Strukturprüfung). Der V4-Planer läuft vorher noch.
6. **Privat-Ausflug**: Idee über `private-proposal.v1`/V6; der V4-Planer liefert nur noch den
   technischen Rahmen (ein Aufruf).

**Kein V4/V5:** alle Ideen-Kerne aus Abschnitt 2, `private_return`, POI-Sightseeing (über den
Wissens-Kern). SAR-Heli ist im Picker abgeschaltet (`SAR_HELI_PICKER_ACTIVE = false`).

**Bleibt Legacy, wird nicht umgebaut:** Sim-Modus, KI aus (lokale Generatoren), Planungsmodus
(`freeflight_planning`), Pipeline-Modi V2/V3 und ihre Rückfälle.

### 6.2 Bush: Prosaheuristiken und Folgeschritte

Im V5-Writer stimmt die Regel aus `Mission Semantics Rules V4.md`:
`_missionWriterV5FinalizeStory` behält Bush-Text (`bush-preserve-writer-v1`), Gründe sind nur
Diagnose. Bush-Kerne (`mission-bush-*-core.js`) lesen keinen Fließtext. **Nach** dem Writer werten
aber noch drei Stellen den deutschen Text aus:

1. **Pickup-Gast (`bush_pickup_strip`, ~Z. 46361–46475):** Der V5-Prompt fordert keine
   `pickupStory`-Felder an. Deshalb füllt `buildAiBushPickupStory` Rückkehrgrund und Einsteige-Satz
   (gehen in die Voice) mit deutschen Wortlisten aus zufälligen Story-Sätzen,
   `bushPickupRoleContext` setzt deutsche Standardsätze nach Rollen-Stichwort. Gilt die Story als
   „flach“ (<260 Zeichen oder Formeln wie „Mission endet, wenn“), wird sie **durch den lokalen
   deutschen Ersatztext ersetzt** – das widerspricht der Bush-Regel „nur Diagnose“.
   `addBushPickupNameToStory` stellt einen deutschen Satz voran, wenn der Name fehlt.
2. **Frachtbezeichnung → Szenen-SimObject** (`sync.js` `_missionSceneSemanticCargoAsset`):
   Wortmuster auf der frei geschriebenen Frachtbezeichnung.
3. **Kleinere Textstellen:** `briefingAlreadyCoversArrival` (deutsches Muster entscheidet über den
   Ankunfts-Hinweis), `_missionWriterV5AlignPassengerRoleInStory` (deutsche Verben, in Englisch
   wirkungslos), feste deutsche Ersatzsätze („Rückholfracht“, „Persönliche Ausrüstung und
   Unterlagen“, Begrüßung, PAX-Zeile).

**Antwort:** Für Englisch braucht Bush keinen eigenen Ideen-Kern. Es reicht, diese Stellen auf
Felder umzustellen und dem Writer eine Sprachvorgabe zu geben. Ein `bush-idea.v1` lohnt erst, wenn
zusätzlich Planer-Aufruf, Wetterbindung oder Vorschlagsauswahl gewollt sind (6.3).

### 6.3 Qualitätsvergleich alt ↔ Ideen-Weg

Was der Ideen-Weg bei den umgebauten Arten tatsächlich verbessert hat:

- **Eine Entscheidung statt verstreuter Ableitungen:** Anlass, Person, Gepäck/Fracht und nächster
  Schritt am Boden werden zusammen geplant; Story, Passagier, Ladung und Voice lesen dieselbe Idee.
  Alte Pfade leiten das nachträglich aus Text ab (genau das passiert beim Bush-Pickup).
- **Kein Überschreiben guter Texte:** Strukturprüfung statt Wortmuster, Fehlschlag → Korrektur-
  aufruf oder sichtbarer Abbruch statt stiller Ersatzprosa.
- **Zahlen gebunden:** Wetter-/Streckenwerte über Referenzschlüssel (`flightBindings`,
  `resolveFlightBriefing`), fehlende Werte → Code-Rückfall. Im Bush-V5-Text ist Wetter freie Prosa.
- **Fakten-IDs und History** für Ortsbezug und Abwechslung.

Bewertung pro Schritt (Nutzen / Regressionsrisiko / Prüfaufwand):

| Schritt | Qualitätsgewinn | Risiko | Kern-Idee | Abfragen | Route/Wetter/Piste |
|---|---|---|---|---|---|
| Bush-Pickup-Felder (6.4 Schritt 2a) | spürbar: Einsteige-/Rückkehrsätze passen zur Person statt Zufallssatz oder Standardsatz; kein stilles Ersetzen der Story | gering–mittel: fehlt ein Feld, braucht es Prüfung + Korrektur statt Wortsuche | bleibt (Planer, Profil-Prompts, `storyBasis`, Spec unverändert) | bleiben alle | unberührt |
| Frachtart als Feld (2b) | konsistenteres Szenenobjekt | gering, wenn Wortsuche Rückfall bleibt | bleibt | bleiben | unberührt |
| Sprachvorgabe (2c) | Englisch direkt statt Übersetzung | **kein** Risiko für Deutsch, wenn der deutsche Prompt Zeichen für Zeichen gleich bleibt | bleibt | bleiben | unberührt |
| Training Sprachvorgabe (3) | nur Englisch | gering | bleibt | bleiben | unberührt |
| Training ohne V4-Planer | spart einen Aufruf | erst prüfen, was der Planer liefert (`enforceTraining…` überschreibt viel) | – | Geo-/Truth-Kontext könnte fehlen | prüfen |
| Bush komplett `bush-idea.v1` (nicht geplant) | potenziell am größten: Wetter gebunden, Vorschläge, eine Idee | **hoch**: Pickup-Phasen, Recon-Plan, Folgeflüge, Supply-Region, Routen-Voices, Szene müssen neu angebunden werden | gefährdet, wenn Profil-Charakter nicht übernommen wird | Geo-Kontext, MissionTruth, Feuerlage, Umgebung, Recon-Kontext müssten neu verdrahtet werden | Wetterteil würde sich sichtbar ändern; Route/Piste unberührt |

Unabhängig vom Writer und nicht gefährdet: Routenblock (`appendMissionBriefingRouteInfo`),
Pisten-/Platzanzeige (Flugplatzdaten, `destRwyContainer`), Platzinformationsseiten
(`MissionAirportInformationCore`, von beiden Wegen gemeinsam genutzt), Manifest-, Lade- und
Runtime-Gates. Abfragen (Geo-Kontext, MissionTruth, Feuerlage, Umgebung, Platzinfos, Recon-Kontext)
laufen beim Feld-Umbau unverändert weiter, weil Planer und Kontextaufbau bleiben.

### 6.4 Freigegebener Plan

Leitlinie: Das gut laufende System nicht verschlechtern, Prüfaufwand klein halten. Deshalb kein
Komplettumbau, sondern kleine Schritte, bei denen sich der deutsche Text nur dort ändert, wo es
beabsichtigt ist.

1. **Messen:** Aufrufe/Tokens Bush (alle sechs) und Training neu messen
   (`tools/gemini-mission-release-live.mjs`, `tools/bush-profile-personality-live.mjs`).
2. **Bush auf Felder** (Fokus nur Bush, andere Missionsarten unberührt):
   a. `pickupStory` (Ort, Grund, Rückkehrgrund, Einsteige-/Abflugsatz) als Writer-Feld mit
      Strukturprüfung; Satzsuche und „flach“-Ersatz nur noch Diagnose. Ändert Bush-Pickup-Texte →
      gezielte Briefing-Prüfung nur für dieses Profil.
   b. Frachtart aus fester Liste als Feld; Wortsuche in `sync.js` bleibt Rückfall für alle anderen.
   c. Sprachvorgabe im Writer, englische Fassungen der festen Ersatzsätze. Deutscher Prompt bleibt
      identisch → deutsche Briefings der übrigen Bush-Profile ändern sich nicht.
3. **Training:** Sprachvorgabe im Training-Writer; Planer-Wegfall nur nach Prüfung, was er liefert.
4. **Restfälle 2–4 aus 6.1 nicht umbauen.** Bei englischer Oberfläche Übersetzung nachreichen
   (Variante C); sie fallen mit dem Entfernen des Legacy-Codes weg.
5. **Bleibt Legacy:** siehe 6.1.
6. **Später, nur bei Bedarf:** `bush-idea.v1` oder gebundener Wetterabsatz für Bush, wenn
   Qualität oder Kosten es nach Feldtest verlangen; eigene Bewertung und Freigabe.

Prüfregel je Schritt: vorher/nachher je Profil drei echte KI-Läufe vergleichen (Story, Begrüßung,
Voice-Sätze, Ladung, Szene); Stub-Tests allein reichen nicht. Änderungen an Wortmustern/Prüfungen
nur mit Freigabe (`AGENTS.md`).

## 7. Umsetzung Bush-Ideen-Kern, Bauweise A (18.11.2026)

Vom User gewählt: Bauweise A – der bestehende Bush-Plan wird zur geprüften Idee, Planer-/Writer-
Prompts und Abfragen bleiben. Kein eigener Ideen-Aufruf (Bauweise B verworfen).

**Befund, der den Umbau trägt** (gespeicherter Live-Lauf `bush_pickup_strip-composer-20261113.json`):
Der Planer plante „Mark, USFS-Funktechniker“. `_missionWriterV5BushPickupCanonicalPassenger` gab dem
Writer den ersten Listenvorschlag („Kartenmacherin“) vor; der Writer schrieb „Elena Vance“. Danach
ersetzte der Code Name (Sierra Lane, Story behielt „Elena“), Begrüßung (Schablone „Gut, dass du da
bist …“) und Titel („Bush-Pickup bei …“); `bush.pickupStory` nannte eine vierte Person. Die übrigen
fünf Bush-Profile waren in allen gespeicherten Läufen stimmig (Plan = Person = Story).

**Umsetzung** (`mission-bush-ideas-core.js`, seit Web v2453 Standard an; Rückweg per
`localStorage ga_bush_idea_v1 = 'off'`):

- `fromContract`: `bush-idea.v1` aus `storyFrame` (subjectDetail, incidentContext, whyNow,
  soughtOutcome Pflicht) plus gesperrter Folge-Passagier. Unvollständiger Plan → alter Weg.
- Nur `bush_pickup_strip`: kein Listen-Passagier als Vorgabe, Writer-Zusatz mit BUSH_IDEA,
  `passenger.pickupStory`-Feldern (Regeln wie V4-Writer 19c/19e) und Namensliste. In
  `sanitizeMissionWriterV5Payload` entfallen bei aktiver Idee Listen-Überschreibung, Namens-
  Ersatz und deutscher Titel-Rückfall; im Bush-Zweig kommen Gepäck und Gewicht aus dem Writer,
  „flach“-Ersatz und Namens-Voranstellung sind nur noch Diagnose.
- Übrige fünf Profile: Writer-Prompt unverändert (Test), Idee wird nur mitgeschrieben.
- Unberührt: Planer, Abfragen, Routenblock, Pisten/Platzinfos, Wetter, Routen-Voices, Recon-Plan,
  Folge-Gedächtnis, Tracker.

**Nachweise:**

- `tools/mission-bush-ideas.test.cjs` (Kern, alle sechs gespeicherten Planer-Verträge ergeben
  eine Idee), `tools/bush-idea-writer-wiring.test.mjs` (echter V5-Writer im VM mit der gespeicherten
  KI-Antwort: alt Sierra Lane/Standardtitel/Schablone, neu Elena Vance/„Abholung der
  Kartenmacherin“/KI-Begrüßung; Story, Fracht, PAX, Platzinfos, Bush-Spec gleich).
- Gesamte `tools/*.test.*` gegen den Stand ohne Änderung: kein Test neu rot.
- Ein Live-Lauf (1 Gemini-Aufruf, gespeicherter Plan wiederverwendet,
  `bush_pickup_strip-idea-20261118.json`): Writer übernimmt die geplante Person (Elias Thorne,
  USFS-Funktechniker, Funkrelais winterfest), Titel „Winterfeste Funkrelais am Big Creek“, eigene
  Begrüßung, alle fünf Abhol-Felder geliefert, Diagnose leer. Platzinfos/Abflugseite vorhanden.
  Harness: `--bush-idea --resume-report=…`.

Vom User freigegeben und standardmäßig eingeschaltet (Web v2453). Offen: MSFS-Feldtest der Abholung (Voice-Sätze),
Sprachvorgabe für Englisch (Phase 4) als nächster Schritt im Kern.

**Nachtrag 19.11.2026:** Plan-Schritt 2b (Frachtart als Feld) umgesetzt: Bush-V5-Writer liefert
`cargoAssetKind` (nur Bush-Profile, Liste aus `mission-cargo-asset-kinds.js`), die Szene nutzt es vor
der Wortsuche. Details: `docs/English Translation Plan.md` 2.15. Offen: Sprachvorgabe (2c), Training (3).
Ergänzt 19.11.2026: Vereins-Idee (`delivery.assetKind`, `luggage.assetKind`, Prompt club-v1.11) und
Charter-Idee (`luggageAssetKind`) benennen die Frachtart ebenfalls; die Szene liest Lieferung vor Gepäck.
