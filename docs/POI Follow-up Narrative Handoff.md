# POI-Folgemissionen: Erzählkontinuität und Übergabevertrag

Stand: 30.09.2026. **Teilweise implementiert, lokal noch nicht veröffentlicht.**
Mapping, Reparaturfoto und Infrastruktur-Nachprüfung verwenden jetzt den additiven
Vertrag `ga.followup-narrative.v1`; siehe [Mapping Survey Migration Audit](Mapping%20Survey%20Migration%20Audit.md).
Die übrigen Abschnitte beschreiben weiterhin das weitergehende Zielbild.
Der eigentliche POI-Writer-Umbau erfolgt separat durch den dafür zuständigen Agenten.
Diese Dokumentation beschreibt dessen technische Anschlussstellen und Abnahmekriterien;
sie öffnet keine Gates und ändert keine Missionsregeln.

## 1. Versionsgrenze und heutiger Stand

Die POI-Familien sind noch nicht auf das neue episodische Writer-System umgestellt.
Die globale Auswahl Writer V4/V5 ist nicht mit dem neuen privaten Episode-Writer
V6 gleichzusetzen. Dessen Referenzprofil ist `private_outing`; siehe
[Episode Writer V6](Mission%20Episode%20Writer%20V6.md).

Bereits vorhanden:

- `poiChain.hiddenOutcome` beziehungsweise `infraInspectionOutcome`: fachlicher
  Befund und bisherige Regeln zur Auswahl eines Folgeprofils.
- `mission-infra-outcome-core.js`: `buildChainReconFollowupConfigForMission`,
  `buildFollowupConfigForMission` und `buildPipelineContext` verbinden Befund,
  Ziel, zeitlichen Abstand, Folgeauftrag und Erzählrahmen.
- `mission-followup.js`: Folgeangebot mit `source`, `narrativeMemory`,
  `infraInspectionOutcome`, `route`, `temporalContext` und `chain`; Annahme
  übergibt `followupSeed` an `generateMission` in `app.js`.
- `tracker-mission-followup.js`: dieselben Originalregeln nach bestätigtem
  Tracker-Abschluss. Authority und Follow-up-Outbox speichern den Abschluss
  gemeinsam; die Cloud-Synchronisierung kann nach Verbindungsproblemen nachholen.
- Der Infrastruktur-Pipelinekontext übernimmt derzeit bis zu 900 Zeichen der
  Ursprungsstory. Das ist ein gekürzter Textanfang, keine semantische Zusammenfassung.

## 2. Gewünschtes Verhalten

Eine Folgemission erzählt denselben Vorgang weiter: gleicher betroffener Ort,
zuordenbarer Befund, nachvollziehbarer Zeitablauf und sinnvoller nächster Auftrag.
Beteiligte und Auftraggeber bleiben konsistent, soweit sie bereits festgelegt sind.
Ein Personenwechsel darf stattfinden, muss aber zum Folgeauftrag passen.

Beispiel, keine feste Produktionsschablone:
Erstbefund am Mast → gezielte Nachprüfung/Kartierung → gegebenenfalls
Reparaturdokumentation → gegebenenfalls Abschlussbegutachtung.
Ob dieser nächste Schritt überhaupt freigegeben wird, entscheiden weiterhin
Outcome-/Follow-up-Regeln. Eine erzählerische Anschlussidee ist keine Freigabe.

Der Writer soll bereits bei der ersten Geschichte kurze offene Fragen und
mögliche Anschlussideen mitliefern können. Noch nicht eingetretene Reparaturen,
Verschlechterungen, Untersuchungsergebnisse oder erfolgreiche Flugleistungen
bleiben ausdrücklich Möglichkeiten. Der tatsächliche Abschluss ergänzt später
nur die vom Missionssystem bestätigten Ergebnisse.

## 3. Additiver Übergabevertrag für den Writer-Umbau

Vorgeschlagener Name: `followUpNarrative`, versioniert als
`ga.followup-narrative.v1`. Name und endgültiges Schema beim Writer-Umbau mit
dessen bestehendem Memory-Vertrag abstimmen; keinen zweiten parallelen
History-Mechanismus bauen. Die folgenden Inhalte sind die Anforderung:

| Inhalt | Quelle und Bedeutung |
| --- | --- |
| Identität | Ursprungsmission, Ketten-ID, Elternmission, Schritt und Abschluss-ID; technische IDs übernimmt der Code. |
| Kurze Zusammenfassung | Writer-Erinnerung an die tatsächlich verwendete Geschichte, im selben Writer-Antwortobjekt wie Story/Greeting. |
| Beteiligte | Bereits festgelegte Personen, Rollen und Organisationen mit stabilen Referenzen, soweit vorhanden. |
| Bekannte Fakten | Technischer Zielbezug, vorbereiteter Befund, tatsächlich offenbarter Befund und bestätigtes Flugergebnis getrennt. |
| Offene Fragen | Was nach dem bisherigen Befund noch unklar ist; keine erfundenen Antworten. |
| Anschlussideen | Wenige optionale narrative Ansatzpunkte; keine neuen TaskDomains, Trigger, Profile oder Szenenbefehle. |
| Abschlussbeleg | Erfolg/Abbruch, tatsächlich erledigte Aufgabe und relevante Cargo-/Befunddaten aus der Authority. |
| Nächster Auftrag | Von bestehenden Regeln ausgewähltes Folgeprofil, Ziel, Zweck und frühester Termin. |
| Verfügbarkeit | Schema-/Writer-Version und Status der Erinnerung, damit fehlender Kontext sichtbar bleibt. |

Technische Fakten referenzieren die bestehenden typisierten Daten, statt sie aus
Story oder PAX-Sätzen per Regex zu rekonstruieren. Freier Writer-Text ist
Erzählkontext, keine ausführbare Anweisung und keine zweite Missionsautorität.

Vorbereiteter Befund und bereits offenbarter Befund müssen unterscheidbar bleiben.
Versteckte Ergebnisse dürfen vor ihrem vorgesehenen Trigger nicht durch Greeting,
Briefing, Kartenanzeige oder ein vorzeitig sichtbares Folgeangebot verraten werden.
Auch eine gespeicherte Geschichte über eine geplante Inspektion beweist nicht,
dass diese erfolgreich geflogen wurde.

## 4. Datenfluss und Verantwortlichkeiten

1. **Generierung:** Der neue POI-Writer liefert Story und kompakte Erinnerung
   gemeinsam. Zusammenfassung beschreibt die angenommene finale Story; eine
   abgelehnte Writer-Antwort darf keine verbindliche Fortsetzung etablieren.
   Zusätzliche Erinnerungsfelder benötigen keinen separaten KI-Aufruf.
2. **Speicherung:** Der optionale Übergabekontext bleibt mit der Mission erhalten:
   lokal, Cloud-Paket, Tracker-Seed, App-zu-App-Transfer, Kartentisch und Export/Import.
   Die Feldaufnahme muss an allen Grenzen explizit getestet werden.
3. **Ausführung:** Der Mission-Worker ergänzt ausschließlich belegte Trigger- und
   Abschlussinformationen. Er generiert keine Prosa und macht keine KI-Anfragen.
   Telemetrie-Empfang, Simulator und Audio bleiben im Parent.
4. **Abschluss:** Bestehende Freigaberegeln erstellen gegebenenfalls das Folgeangebot.
   Erinnerung und bestätigtes Ergebnis werden anhand derselben Mission-/Abschluss-ID
   zusammengeführt und mit dem bestehenden Abschluss-/Outbox-Vorgang gespeichert.
   Kein doppeltes Angebot nach Wiederholung, Neustart oder erneuter Synchronisierung.
5. **Annahme:** Der Folge-Seed enthält fachlichen Auftrag und kompakten Erzählkontext.
   Planner/Writer verwenden beide; der technische Contract gewinnt bei Widersprüchen.
6. **Weitere Folgen:** Aktuellen Stand zusammenfassen und offene Fragen fortschreiben.
   Frühere Zusammenfassungen nicht unbegrenzt ineinander verschachteln oder alle
   Briefings anhängen. Die Missionskette bleibt über IDs nachvollziehbar.

Der andere Agent implementiert Writer-Ausgabe, Validierung und Prompt-Nutzung.
Die technische Integration muss die Transporte, Abschlussanreicherung und
Follow-up-Seed-Anbindung absichern. Beide Seiten verwenden denselben Vertrag.

## 5. Bestehende Missionen, Ressourcen und Fehlerfälle

- Altdaten ohne neue Erinnerung bleiben ausführbar und können Folgeangebote erzeugen.
  Fallback sind bestehender Befund, Ziel, Auftrag und `narrativeMemory`; den alten
  Story-Ausschnitt ausdrücklich als Legacy-Kontext behandeln, nicht als geprüfte
  Zusammenfassung ausgeben.
- Ungültige optionale Writer-Erinnerung sperrt keine fachlich gültige Mission.
  Status melden und auf vorhandene strukturierte Fakten zurückfallen; keine
  zusätzliche Reparatur-KI und keine erfundene Code-Zusammenfassung.
- Technisch notwendige Daten nicht still kürzen. Widersprüchliche Identitäten oder
  fehlende fachliche Pflichtdaten bleiben ein klarer Validierungsfehler.
- Vor Implementierung feste Zeichen-/Listen-/Bytebudgets für den optionalen Kontext
  festlegen und mit realen Paketen messen. Ziel sind wenige KiB pro Übergabe,
  keine komplette wachsende Historie; bestehende Profilgrenze bleibt verbindlich.
- Bestehende verlustfreie Paketübertragung und Wiederverwendung unveränderter Teile
  nutzen. Keine neue Worker-Cloud-Schreiboperation pro Telemetriesample oder Voice.
  Zusätzliche Kontextdaten beim ohnehin nötigen Speichern/Abschluss bündeln.
- Kein Versprechen kostenfreier Erinnerung: zusätzliche Writer-Ausgabe- und spätere
  Eingabetokens sowie kleine zusätzliche Paketdaten; kein eigener Aufruf nötig.

## 6. Abnahme gemeinsam mit dem Writer-Agenten

- Neue Story und gespeicherte Erinnerung stimmen in Stichproben inhaltlich überein;
  reine JSON-Validierung beweist das nicht.
- Erstbefund → Abschluss → Folge-Seed → nächste Writer-Anfrage behält konkreten
  Zielpunkt, Beteiligte, Befund, offene Frage und zeitlichen Bezug.
- Keine erfundene erfolgreiche Aufgabe nach Abbruch; unauffälliger Befund erzwingt
  keine Schadenserzählung. Keine vorzeitige Veröffentlichung versteckter Befunde.
- Writer-Anschlussidee kann weder Folgefreigabe noch fachliches Profil überschreiben.
- App und Tracker liefern für denselben bestätigten Abschluss denselben Kontext.
- Reload, Worker-Neustart und doppelte Abschluss-/Cloud-Zustellung erzeugen keine
  doppelten Folgeangebote und verlieren keinen Kontext.
- Cloud, Kartentisch, Export/Import und App-Wechsel erhalten die neuen Felder.
- Altdaten ohne Erinnerung sowie beschädigte optionale Felder funktionieren über
  den beschriebenen Fallback; mehrstufige Ketten bleiben innerhalb der Budgets.

Dieser Eintrag dokumentiert die gewünschte Situation. Die Schema-/Transport- und
Writer-Änderungen sind erst nach ihrer separaten Implementierung als umgesetzt zu
markieren.


## Anschluss der Hauptinspektion, 09.10.2026 (lokal)

Der initiale Infrastruktur-Writer liefert jetzt `continuationMemory` zusätzlich
zur bisherigen History-Notiz. Es wird über den bestehenden Narrative-Core in
`followUpNarrative` übernommen. Bestätigter Tracker-Abschluss und Nachkontroll-
Writer verwenden ihre bestehenden Anschlussstellen. Es werden keine neuen
Runtime-/Cloud-Endpunkte eingeführt. Umfang, Rückfälle und offene Live-Abnahme:
[Infrastruktur-Inspektion](Infrastructure%20Inspection%20Briefing%20Migration.md).


## Gemeinsame Erzählregeln der Infrastruktur-Kette, 09.10.2026 (lokal)

`MissionPoiFollowupNarrativeCore.writerRules()` ist die gemeinsame Erzählbasis
für Inspektion, Mapping und Foto. Die Profil-Cores ergänzen ihren vorhandenen
fachlichen Vertrag und geben diese Regeln an Haupt-/Folgewriter weiter.
Reparaturfoto erbt Fotoregeln, Nachkontrolle und Abschlussbegutachtung
Inspektionsregeln; Schadenskartierung verwendet weiterhin seinen vorhandenen
Mapping-Writer mit unverändertem Survey-Muster. Keine neuen Falllisten,
Klassifikation oder Freigaberegeln. Zitate sind erlaubt, Ergebnisse bleiben
vor dem jeweils bestätigten Abschluss offen.

Die bestehende Folgeplanung setzt nach Mapping bereits Auswertung und laufende
Reparaturen, später eine abgeschlossene Reparatur voraus. Gemeinsame Writer-Regeln
beweisen diese Ereignisse nicht. Vor breiter Abnahme muss entschieden werden,
welche Zwischenschritte als ausdrücklich festgelegte fiktionale Planung gelten
und welche als bestätigte Ergebnisse geführt werden. Ergebnis-/Profil-Logik
wurde bei dieser Erzählregel-Anpassung nicht geändert.


### Zwischenzeitliche Entwicklung ausdrücklich freigegeben, 09.10.2026

Nutzerklarstellung: Zwischen den Flügen soll mindestens Auswertung, gegebenenfalls
auch umfangreiche Arbeit stattgefunden haben. `narrativeMemory.betweenFlights`
kennzeichnet diese etablierte fiktionale Vorgeschichte als `fictional_story_plan`
vor dem nächsten Flug. Erstinspektion → Folge: Befund ausgewertet. Kartierung
→ Reparaturfoto: Daten ausgewertet und Arbeiten begonnen. Reparaturfoto →
Abschlussbegutachtung: Arbeiten fortgeführt, Betreiber meldet Abschluss.
Die Freigabe des Bauwerks und das Ergebnis des kommenden Flugs bleiben offen.
Der bestehende Kontextadapter reicht den Abschnitt an die Writer weiter;
Abschlussbelege, verfügbare Profile und Termine bleiben bei den vorhandenen
Regeln. Tests prüfen die Übergabe entlang der bestätigten Headless-Kette.
Lokaler Arbeitsstand, noch nicht veröffentlicht.

### Dynamische Zwischenentwicklung, ersetzt feste Texte (lokal)

Der Writer liefert nun optionale `betweenFlightsIdeas` in seiner bestehenden
Erinnerung: höchstens vier `{followUpKind, summary}` mit jeweils 600 Zeichen.
Die Erstinspektion verwendet continuationMemory, Mapping und weitere Folgen
verwenden memory. Vorschläge bleiben bis zur tatsächlichen Folgefreigabe
optional. Der bestehende Kontextadapter wählt ausschließlich die Idee zum
freigegebenen Folgeauftrag und liefert sie als `betweenFlights` mit Ursprung
`writer_story_plan`. Bestätigte Abschlussdaten bleiben separat. Ohne gültige
Idee entwickelt der Folgewriter einen passenden Zwischenablauf aus vorhandenem
Befund und Auftrag. Es gibt keine fest vorgegebenen Ereignistexte mehr. Keine
zusätzlichen KI-Aufrufe, Endpunkte oder Änderungen der Missionsfreigabe.

### PAX-Wechsel, 10.10.2026 (lokal)

Eine kurze gemeinsame Writer-/Voice-Regel nutzt die vorhandenen Beteiligten
und deren Namen aus der Übergabe: Neue Fachpersonen kennen den Vorgang aus
diesen Unterlagen, beanspruchen aber nicht die frühere Flugteilnahme oder
Beobachtungen für sich. Namentlicher Bezug ist möglich; persönliche Bekanntschaft
wird nicht vorausgesetzt. Keine neuen Datenfelder oder Textfilter. Die bildliche
Formulierung einer Begehung bleibt zulässig.

### Folgeangebot und Entwurf, 10.10.2026 (lokal)

Die lokale Annahmesperre schützt nur die laufende Generierung und wird in finally
auch nach erfolgreicher Vorschau oder Fehler aufgehoben. Erst bestätigte
Missionsannahme markiert das Angebot accepted; Verwerfen lässt es pending.
Die App plant eine lokale Aktualisierung an Freigabe-/Ablaufgrenzen, prüft
dabei spätestens jede Minute die Wanduhr und aktualisiert zusätzlich beim
Sichtbarwerden. Headless-Tracker erzeugt keine UI-Timer. Keine neuen Cloud-Calls.


## Alpha-Freigabe 10.10.2026

Die in diesem Chat umgesetzten Writer-Übergaben, dynamischen Zwischenideen,
PAX-Kontinuitätsregeln und Folgeangebots-UI-Korrekturen werden auf Origin/Alpha
mit Tracker v509 veröffentlicht. Stable bleibt auf v508 unverändert.
101 relevante Node-Tests bestanden; die vierteilige Live-Kette wurde mit
simulierten Abschlüssen geprüft. Keine neue MSFS-/Mehrgeräte-Abnahme behauptet.
