# POI-Folgemissionen: Erzählkontinuität und Übergabevertrag

Stand: 22.09.2026. **Abgestimmtes Zielbild, noch nicht implementiert.**
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
