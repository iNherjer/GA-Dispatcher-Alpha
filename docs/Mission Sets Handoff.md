# Missionssets: Arbeitsgrundlage und aktueller Ablauf

## Medizin-Transfer: Alpha-Release Web v1916 / Tracker v471, 05.10.2026

Eigener Ideen-/Writer-/History-Pfad für explizites APT `medical_transfer`, mit Personaltransfer, begleiteter Materiallieferung und geplanter sitzender Patientenverlegung. Die ersten beiden Varianten haben einen PAX; `patient_transfer` hat genau einen Patienten plus eine medizinische Begleitung (2 PAX), getrennte Identitäten und medizinische Begleitung als Voice-Persona. Nur `seated_assisted`, keine Trage oder komplexe MedEvac-Abläufe. Krankenwagen bringen beide zum Start-Abstellbereich und übernehmen sie am Ziel. Patient ist keine Fracht. Positive Sendungsgewichte innerhalb der Entwurfsgrenze. Dringlichkeit folgt dem Auftrag. Begrüßung kommt vom bereits eingestiegenen Begleiter an den unbenannten Piloten. Keine nachträgliche Prosa-Reparatur im neuen Pfad.

Patientenverlegung setzt zwei verfügbare Passagierplätze und `mission.scene.medical-group.v1` voraus. Alter Tracker darf keine Zweier-Verlegung erzeugen/akzeptieren; Capacity-Revalidierung und Finalisierung verhindern stilles Kürzen auf einen PAX. Gemeinsamer Group-Core erweitert nur explizite Zweierkommandos mit `groupVehicleKind:medical`; bestehende Gruppen bleiben Van/Bus. Medizinische Titel werden aus dem bestehenden Katalog gewählt. Tracker v471 enthält den geänderten Group-Core und Relay-Handshake; Windows/MSFS-Feldabnahme bleibt offen.

Vorschlagsannahme, Quota-/Cloud-Kompaktierung, Restore und Contract erhalten die Idee. Der Empfangskontakt und die geplante Übergabe werden aus ihr übernommen; bei Personal/Material reguläres Abholfahrzeug, bei Patientenverlegung medizinisches Empfangsfahrzeug. Bestehende medizinische Cargo-Assets und separate Pflichtlieferung bleiben erhalten, keine neue Runtime-Authority. Nur initiale KI-Aufträge; Offline, POI, Bush und Folgeaufträge bleiben auf ihren bisherigen Wegen.

Lokale Integrationstests prüfen Personen-/Sendungsidentität, Auswahlannahme, Kapazitätswechsel, History-Trennung, Manifest, Empfangskontakt und Wetterabsatz. Gemini-Live-Proben am 05.10.2026: drei neue Ideen, nach Nachschärfung drei weitere Ideen und abschließender Writer-Durchgang auf denselben Aufträgen; alle angenommen. Prompt v1.3 trennt fiktive Einrichtungen, Entwurfshistory, Erzähler und bereits eingestiegenen Begleiter. Finale drei Ergebnisse zusätzlich durch echten Arrival-Resolver/Item-Builder geprüft: Identität, Sendung, Empfänger und Van konsistent. Bericht: `analysis/medical-transfer-live-20261005-v3.json` und `.md` (lokale Prüfartefakte). Zusätzlich geplante Patientenverlegung live geprüft: Patient Bernhard Müller und Begleitung Elena Weber, 2 PAX, Prompt v1.5 mit strukturiertem `groundTransfer` für Krankenwagen an beiden Enden. Bericht: `analysis/medical-patient-transfer-live-20261005-v2.json` und `.md`. Die erste Probe nannte am Ziel nur ein Fahrzeug; positiver Vertrag und Writer-Vorgabe wurden daraufhin präzisiert, ohne Prosa-Reparatur. Keine Live-Wetterdaten, kein reales TTS-Audio, kein MSFS-Spawn. Sprache teils noch förmlich; Proben beweisen keine medizinische Fachvalidierung. Alpha-Release Web v1916 / Tracker v471; 31 gezielte Tests und Authority-/Sync-/Cargo-Selbsttests bestehen auch auf der integrierten v470-Basis. Fortsetzungen/Rückflüge benötigen weiterhin den gesonderten Kontinuitätsdurchgang; diese Änderung erklärt sie nicht für modernisiert.

## Bestandsaufnahme der APT-/POI-Modernisierung, 04.10.2026

Geprüfter veröffentlichter Alpha-Stand: Web v1907, Commit `a446aa0e8`,
Tracker Alpha v467. Die folgenden älteren Abschnitte dokumentieren ihre damaligen
Entwicklungsstände. „Modernisiert“ bedeutet einen im aktiven Dispatch tatsächlich
angeschlossenen profilspezifischen Ideen-/Writer- oder Trainingspfad; es bedeutet
keine abgeschlossene Windows-/MSFS-Feldabnahme und keine Stable-Promotion.

### APT: alle auswählbaren Auftragsfamilien

| Auswahl / Profil | Inhaltlicher Pfad auf Alpha | Teststand / nächste Arbeit |
| --- | --- | --- |
| Privat / `private_outing` | Modernisiert: strukturierte Idee, V6-Episode, History | Heutige Vertragsregressionen bestanden; Private-Return-Testumgebung siehe unten |
| Verein / `club_utility` | Modernisiert: eigener Ideen-/Writerpfad, optionale narrative Ereignisse | Heutige Vertragsregressionen bestanden |
| Charter / Kategorie `charter` | Modernisiert: eigener Ideen-/Writerpfad, Gruppen und Charter-Fortsetzungen | Heutige Ideen-/Fortsetzungsregressionen bestanden |
| Cargo ohne PAX / Kategorie `cargo` | Modernisiert: eigener Frachtideen-/Writerpfad | Heutige Vertragsregressionen bestanden |
| Fragile Fracht / `cargo_fragile` | Modernisiert: eigener Ideen-/Writerpfad mit Begleitung | Heutige Vertragsregressionen bestanden |
| Sightseeing / `sightseeing_tour` | Modernisiert: APT-Besuchsauftrag mit Ortsbelegen und Zielplatz | Heutige Vertragsregressionen bestanden; nicht mit POI-Beobachtung verwechseln |
| Training / Kategorie `trn` | Modernisiert: gemeinsames Trainingsbriefing und separates quellengebundenes Coaching, `training-narrative-v9` / `training-coaching-v4` | Narrative- und Tracker-APT-Integrationstests bestanden; Referenzen werden beim manuellen Übungsstart fixiert |
| Medizin-Transfer / `medical_transfer` | **Alpha Web v1916 / Tracker v471: eigener Ideen-/Writer-/History-Pfad** | Personal, Material und geplante sitzende Patientenverlegung (2 PAX); Tracker v471; Windows/MSFS-/Audio-Feldabnahme offen |
| Tiertransport / `animal_transport` | **Eigener Ideen-/Writer-/History-Pfad, Alpha v1910** | Strukturierte Sendung und Tierbegleitung; Verlade-/Arrival-Assets, Manifest und Restore geprüft. Voice-Audio/Simulator-Feldabnahme noch offen |
| Reporter / `news_coverage` | **Noch alter allgemeiner Planner-/Writerpfad**, profilspezifische Briefing-Synchronisierung vorhanden | Eigene APT-Migration fehlt; der neue POI-Reporter-Adapter aktiviert sich ausschließlich bei `isPOI` |

### POI: alle auswählbaren Auftragsfamilien

| Auswahl / Profil | Aktiver modernisierter Pfad auf Alpha | Teststand / Grenzen |
| --- | --- | --- |
| Foto/Film / `media_photo` | `MissionPoiBriefingBrowser` | Heutige Vertragsregressionen bestanden; ausgewählte Idee trägt den professionellen Fotoauftrag |
| Inspektion / `inspection_infra` | `MissionInfraBriefingBrowser` | Heutige Vertragsregressionen bestanden; initiale Einzelziele, Fortsetzungen separat |
| Ketten-Erstbefund / `infra_chain_recon` | `MissionChainBriefingBrowser` | Heutige Vertragsregressionen bestanden; Korridor-/Kettenziele und Voice-Handoff bereits veröffentlicht |
| Mapping/Survey / `mapping_survey` | `MissionMappingBriefingBrowser`, einschließlich eigenem Fortsetzungspfad | Heutige Vertragsregressionen bestanden; Pattern-/Abschluss-/Handoff-Authority bleibt technische Grundlage |
| Reporter / `news_coverage` | `MissionNewsBriefingBrowser`, geografischer Reporter-Szenenkontext | Heutige Vertragsregressionen bestanden; fachlicher Unterschied zum APT-Transfer |
| Sightseeing / `sightseeing_tour` | `MissionKnowledgeBriefingBrowser` | Heutige Knowledge-Regressionsprüfungen bestanden; lokale Beobachtungsgruppe, belegte öffentliche Fakten oder ausdrücklich fiktive persönliche Geschichte |
| Lern-Guide / `tour_guide_knowledge` | `MissionKnowledgeBriefingBrowser` | Heutige Knowledge-Regressionsprüfungen bestanden; Freund zeigt historische oder heutige Orte |
| Historiker / `historian_guided_tour` | `MissionKnowledgeBriefingBrowser` | Heutige Knowledge-Regressionsprüfungen bestanden; historische Zielauswahl und Quellenfakten |
| Bio/Umwelt / `science_bio` | `MissionBioBriefingBrowser` | Heutige Vertragsregressionen bestanden; Luftbeobachtung und fachliche Quellen-/Hypothesengrenzen |
| Geo/Relief / `science_geo` | `MissionGeoBriefingBrowser` | Heutige Vertragsregressionen bestanden; initiale Einzelziele, qualitative Forschungsfrage |
| Training / Kategorie `trn` | Gemeinsames `fetchTrainingNarrative` und separates Coaching | Narrative- und Tracker-POI-Integrationstests bestanden; Gebiet ist Trainingsraum |
| SAR/Rescue / `search_and_rescue` | `MissionSarBriefingBrowser`, `sar-search.v2`, geografische Szene | Heutige Briefing-/Tracker-Integrationstests bestanden; verdeckter Befund, Suche, Sichtkontakt oder kein Kontakt, Freigabe und Rückkehr |
| Fire Watch / `fire_watch` | `MissionFireBriefingBrowser`, Fire-Suche und geografische Szene | Heutige Briefing-/Tracker-Integrationstests bestanden; mehrere Spots, thermischer/visueller Befund, Abschluss und Debriefing |
| SAR Heli / `sar_heli` | **Deaktiviert** (`SAR_HELI_PICKER_ACTIVE = false`) | Nutzerentscheidung: vollständiges Rewrite erst zum Schluss; nicht als aktive fehlende POI-Migration zählen |

### Auswahlmodi und Umfang

APT/POI „alle Kategorien“ bzw. Auto sind Auswahlmechanismen, keine zusätzlichen
Missionsprofile. Freiflug/Planung ist absichtlich kein Missionsauftrag und braucht
keinen Einsatz-Writer. Die Einträge „Ziel: Brücke/See/Stadt/...“ wählen Zieltypen,
keine neuen Auftragspfade. Training ist eine Kategorie mit verschiedenen
TaskDomains und daher trotz fehlendem normalen Rollenprofil ausdrücklich erfasst.
Private Heimreise und Charter-Fortsetzungen sind bereits eigene veröffentlichte
Anschlusspfade; Mapping hat ebenfalls einen eigenen Fortsetzungsadapter. Andere
Folge-, Ketten-, Offline- und lokale Fallbackpfade sind nicht automatisch durch die
Modernisierung eines initialen KI-Auftrags mit abgenommen.

### Nachweise und offene Prüfungen

Die Inventur vergleicht `MISSION_PICKER_OPTIONS`, `MISSION_ROLE_TASK_PROFILES`,
`generateMission`, die Adapter-`enabled()`-Bedingungen und den Git-Verlauf im
veröffentlichten Stand. Insbesondere wurden die APT/POI-Verzweigungen getrennt
geprüft. Frühere Doku-Sätze wie „unveröffentlicht“ sind teilweise historische
Zwischenstände: etwa Infrastruktur-Prompt v1.9 ist bereits im veröffentlichten
Commit `688b094cf` enthalten. Solche Sätze allein sind kein Release-Nachweis.

Am 04.10.2026 wurden 20 fokussierte Briefing-/Ideen-/Fortsetzungs-Testdateien
mit 260 Prüfungen ausgeführt: 259 bestanden, eine scheiterte. Zusätzlich bestanden
60 Tracker-Integration-/Coachingprüfungen für APT/POI-Training, SAR und Fire Watch.
Keine neuen kostenpflichtigen KI-Aufrufe, TTS- oder Simulatorflüge in dieser Inventur.
Bestehende Live-Textproben sind in den jeweiligen Migrationsdokumenten dokumentiert;
sie ersetzen keinen vollständigen Flug-/Hörtest.

Der eine Fehler ist ein nachgewiesener **Test-Fixture-Defekt**:
`tools/mission-private-return.test.cjs`, Test „deep cloud compaction retains private
episode, recap and voice identity“, erzeugt für die originale Browserfunktion aus
`sync.js` einen leeren VM-Kontext ohne `window`. Mit ausschließlich `window: {}`
in einer temporären In-Memory-Gegenprobe bestehen alle 16 Private-Return-Prüfungen.
Produktcode und Testdatei wurden in dieser Inventur nicht verändert. Die dauerhafte
Fixture-Korrektur ist als kleine Testpflege offen, keine fehlende Profilmigration.

Im aktuellen Release-Worktree liegt kein zusätzlich fertiges, unveröffentlichtes
APT-/POI-Modernisierungspaket. Der ältere gemeinsame Desktop-Checkout enthält
umfangreiche fremde/ältere WIP-Dateien; dessen bloßer Git-Status eignet sich nicht
zur Bestimmung „lokal fertig, noch nicht online“. Er wurde nur gelesen und nicht
verändert. Die Tabelle gilt für den nachweislich veröffentlichten Alpha-Stand.

### Verbindliche Restreihenfolge

1. APT Tiertransport: veröffentlicht mit Alpha v1910; Voice-Audio/Simulator-Feldabnahme offen.
2. APT Medizin-Transfer.
3. APT Reporter (Transfer zu einem journalistischen Bodenauftrag).
4. Gemeinsame Abschlussprüfung der modernisierten Familien: Simulator/EFB,
   Voice, Speicher/Restore und Follow-ups; offene Feldabnahme gezielt erfassen.
5. SAR Heli erst zum Schluss als getrenntes vollständiges Rewrite.

Diese Inventur ändert keine Klassifikation, Verträge oder Runtime. Bush-Profile
bleiben außerhalb dieser APT-/POI-Bestandsaufnahme; ihre Roadmap bleibt separat.


Stand 15.09.2026, Alpha-App v1763. Privat-Writer V6 (Promptkennung V6.3.1,
inklusive ergänzter Rückflugvorschau), Return-Writer V1.3; Tracker bleibt v404.
Dieser Einstieg bündelt den implementierten Stand und die Übertragung auf weitere
Missionssets. Er ersetzt nicht die fachlichen Contracts.

Ergänzung vom 28.09.2026: [Normale APT-Fracht – Ideen V1](Mission%20Cargo%20Ideas%20V1.md) beschreibt den neuen Cargo-Erzählpfad auf der ursprünglichen Transportlogik (Alpha-App-Cache v1867).

Lokal ergänzt am 28.09.2026: [Fragile APT-Fracht – Ideen V1](Mission%20Fragile%20Cargo%20Ideas%20V1.md), eigener Ideenvertrag mit einem Frachtbegleiter und ursprünglicher Liefer-/Schadenslogik. Alpha-Release v1868: drei erste Live-Texte führten zur Präzisierung des bereits gebuchten Lieferauftrags; der nachgeschärfte Prompt ist lokal geprüft, noch nicht erneut live generiert.

## Ziel und Promptprinzip

Die KI entwickelt eine zusammenhängende Absicht und erzählt daraus ein
persönliches Vorflugbriefing. Der Spieler versteht, warum der Flug bevorsteht,
wer dabei ist und was nach der Landung geplant ist. Bei privaten Missionen wollen
beide etwas gemeinsam unternehmen; auch der Pilot kann den Anstoß geben.
Ein kleiner alltäglicher Anlass ist ebenso vollständig wie ein besonderes Ziel.
Die sprachliche Ausführlichkeit soll sich nach dem Inhalt richten.

Prompts beschreiben diese Zusammenhänge positiv. Sie geben der KI eine Aufgabe
zum Entwickeln einer Idee, keine Liste gewünschter Aktivitäten zum Abhaken.
Konkrete Nutzerbeispiele gehören zur Diskussion und Evaluation; ihre übertragbare
Eigenschaft wird in den Prompt übernommen, nicht ihr Gegenstand als Pflichtanker.
Aus dem Wunsch nach menschlichen Anlässen folgt beispielsweise eine eigene
Absicht beider Figuren, keine vorgeschriebene Freizeitbeschäftigung.

Örtlicher Kontext ist eine unvollständige Sammlung von Möglichkeiten. Er kann
einen Anlass wecken oder zu einem unabhängig entstandenen Wunsch passen. Die
KI muss keine Sehenswürdigkeit behandeln. Beziehung, persönliche Verabredung
und Freude am gemeinsamen Flug dürfen allein tragen. Namen und Gepäck folgen
der Idee, statt die Idee aus einem vorab gewählten Gegenstand abzuleiten.

Die Ideenphase soll gedanklich mehrere unterschiedliche Anlässe betrachten und
einen wählen. Das ist eine Promptvorgabe, keine gemessene interne Suchstrategie.
Die Ausgabe enthält die Entscheidung strukturiert; es werden weder private
Denkprotokolle angefordert noch mehrere zusätzliche API-Aufrufe erzwungen.

## Ablauf und Zuständigkeiten

1. **Flugrahmen:** Die App bestimmt technisch zulässige Flugplätze/Route,
   Zieltyp, TaskDomain, Personenrahmen und verfügbare Daten. Diese bleiben
   Grundlage des Contracts. Prosa entscheidet nicht über Missionsmechanik.
2. **Orts- und Wetterkontext:** Begrenzte Quellen/Ortsbelege dienen der Idee;
   aktuelle Messwerte und Stationsbezug dienen dem Flugabsatz. Modellwissen
   allein belegt keine aktuelle Veranstaltung oder Öffnung. Für belegte
   Ereignisse ist die laufende Woche mit passendem Aufenthalt vorgesehen.
   Benannte Bodenanker werden gegen den mitgelieferten räumlichen Kontext
   geprüft; Luftlinie ist kein Nachweis von Fahrzeit.
3. **Direktgenerierung:** Ein Ideenaufruf erzeugt Anlass, konkrete Absichten,
   Initiative/Auslöser, Person, Gepäck und Bodenplan als JSON. Ein Writer-Aufruf
   formuliert genau diese Idee. Der Writer soll keinen neuen Anlass erfinden.
4. **Dreier-Picker:** Ein gemeinsamer KI-Aufruf entwickelt je eine vollständige
   Idee für drei vorbereitete Zielrahmen. Die Ideen vergleichen sich untereinander
   und mit der History. Auswahl bewahrt die strukturierte Idee; anschließend
   schreibt nur der Writer das gewählte Briefing. Kein erneutes Ziehen aus einem
   Aktivitätskatalog. Ungültige oder inzwischen unpassende Auswahl wird sichtbar
   abgelehnt, statt still eine andere Mission zu erzeugen.
5. **Writer-Ausgabe:** Titel, Story, Flug-/Wetterabsatz, Greeting, kompakte Memory
   und optional vorbereiteter `returnOfferText`. Die Story erzählt vor dem
   Hinflug. Der außenstehende Erzähler spricht den Spieler mit du und beide mit
   ihr an; nur Greeting ist direkte Rede der Begleitung. Flugwerte werden durch
   Referenzen eingesetzt. Das sichert Zahlen/Einheiten, nicht jede sprachliche
   Schlussfolgerung über Wetter oder Fliegbarkeit.
6. **Speicherung:** Die gültige Idee bleibt als `privateOuting` im Missionsvertrag.
   Ausflug, Picker-Auswahl und Writer teilen dieselbe Basis. Strukturelle
   Prüfungen sichern Contracts; optionale Erzählmetadaten sollen eine sonst
   brauchbare Mission nicht unnötig verwerfen.

## History: selbst erzeugte Vergleichsfälle statt vorgegebener Muster

Der Writer beschreibt seine fertige Ausgabe kompakt als `episode-memory.v1` im
selben JSON. Der Code muss Tätigkeit, Motivation oder Sprachmuster nicht aus dem
Briefing mittels Regex rekonstruieren. Die KI liefert damit selbst die konkreten
Vergleichsfälle für die nächste Generierung. Diese Fälle sind **keine positiven
Vorlagen zum Nachahmen**, sondern zeigen, was die Serie bereits verwendet hat.

Gespeichert werden kurze Felder für Zusammenfassung, Tätigkeit, Motivation,
Flugrolle, Beziehungsdynamik, Einstieg, Rhythmus, Schluss und markante Formulierung.
Aus der Idee kommen zusätzlich Name, Beziehung, Ziel, persönliche Absicht beider
Figuren und `origin` mit Initiative und Auslöser. Die Speicherung ist begrenzt:
`ga_private_episode_history_v1`, maximal zwölf Einträge und ungefähr 32 KiB
(UTF-16-Schätzung). Ältere strukturierte V5-History kann ergänzend gelesen werden.

Die Ideenphase sieht Anlässe, Personen und Beziehungsmuster. Der Writer sieht
insbesondere Einstieg, Rhythmus, Schluss, markante Formulierung und Initiative.
Beide sollen funktionale Wiederholung erkennen: Ein anderer Ort oder Name allein
ändert weder den Anlass noch eine immer gleiche Rollenverteilung. Der Writer
vergleicht zusätzlich die Erzählstruktur, statt nur Synonyme auszutauschen.
Es gibt keine feste Rollenquote, Themenrotation oder wachsende Verbotsliste.

Gespeichert werden generierte Missionsentwürfe mit gültiger Memory, keine bloßen
Picker-Vorschläge. Gleiche Missions-ID ersetzt den Eintrag. Das ist bewusst ein
Entwurfsgedächtnis: **generiert ist nicht geflogen**. Es darf keine gemeinsame
Flugvergangenheit der Figuren daraus entstehen. Tatsächliche Abschlussbelege
und Rückflugkontinuität sind getrennte Daten.

Die Varianzhistory liegt lokal im Browser, je Origin/Gerät. Sie ist kein eigener
Cloud-Sync-Bestand. HTTPS-Alpha, lokaler HTTP-Server und ein anderes Gerät können
unterschiedliche History haben. Aktive Verträge und Follow-up-Anfragen werden
über die vorhandene Cloud-Speicherung transportiert; das ersetzt keine komplette
Varianzhistory. Ein Cache-Update löscht diese nicht gezielt. Speicherfehler,
Browserbereinigung und Gerätewechsel bleiben mögliche Ursachen fehlender Einträge.
`History=N` belegt bereitgestellte Vergleichsfälle, nicht deren wirksame Nutzung.

## Rückflug und Voice

Ein erfolgreicher normaler Hinflug erzeugt ein optionales, sofort fälliges
`private_return`-Angebot. Abschluss, gemessener Flug, richtiger Zielort und
Bodenstillstand werden geprüft. Der separate Debug-Einstieg erzeugt eine markierte
Testfortsetzung, ohne Logbuch oder realen Flugnachweis zu erfinden. Das Angebot
nennt beide Plätze; neue Ausflüge liefern einen kurzen vorbereiteten Rückblick,
ältere Verträge verwenden einen allgemeinen Text mit Begleiternamen.

Bei Annahme schreibt ein Return-Aufruf einen gemeinsamen fiktionalen Aufenthalt
als Zusammenfassung, persönliche Reaktion und Einzelmomente sowie Briefing,
Flugabsatz und Greeting. Route, Personen und Gepäck bleiben gebunden. Ungültige
optionale Einzelmomente werden begrenzt verworfen und diagnostiziert; fehlende
Pflichtdaten oder ungültige Flugwertreferenzen bleiben ein Fehler. Das Angebot
bleibt dann verfügbar. Es gibt keine automatische Reparatur-Generierung.

Die Voice bekommt denselben Rückblick und die letzten vier lokal ausgegebenen
Texte dieser Heimreise. Sie darf plausible persönliche Details ergänzen und soll
jeweils neuen Inhalt beitragen. Die Angaben sind kein Beleg realer Ortsfakten
oder Flugereignisse. Der Wortlautpuffer ist weder persistent noch ein Nachweis
hörbarer Wiedergabe. Flugfeedback und notwendige kurze Ansagen haben Vorrang.

Private Return bleibt ein regulärer A-B-Lauf ohne Bush-Pickup-Phasen. Zusätzlich
wird einmal nach mindestens 60 Sekunden erkannter Flugphase und ab 500 ft AGL
eine kurze Aufenthaltserzählung eingereiht. Boden/Pause setzen die noch laufende
Wartezeit zurück; ausgeschaltete Stimme, Ankunft und Missionsende blockieren sie.
Die normale Queue übernimmt Epoch-/End-Lock-Schutz. v1763 korrigiert den Aufruf
im Debug-Sim-Zweig: Der übersprungene Live-Rekorder hatte die Ansage bisher
verhindert. Ein vollständiger Runtime-Reset erlaubt einen neuen Testlauf.

## Kosten und Grenzen

Direkt: Idee + Writer. Picker: ein Dreier-Ideenaufruf + Writer für die Auswahl.
Memory und Rückflugvorschau entstehen in diesen Antworten. Rückflugangebot ohne
KI, Annahme mit einem Return-Writer. Wetter, Kontextrecherche, technischer Planner
und Szenenplanung sind zusätzliche Pipelinearbeit. Voice benötigt pro Ansage
Textgenerierung und TTS; die Abfluganekdote fügt höchstens einen solchen Vorgang
je Lauf hinzu. Provider-Fallbacks können weitere Requests auslösen.

Prompts sichern keine absolute Vielfalt. Ortsauswahl kann bestimmte Ideen
begünstigen, kleine History kann Muster übersehen und ein Modell kann trotz
Vergleich ähnlich schreiben. Die begrenzte Memory kann Nuancen verlieren.
Stil und semantische Stimmigkeit brauchen daher echte Text-/Voice-Prüfung.

## Übertragung auf weitere Missionssets

- Zuerst Zieltyp, TaskDomain, Rollen, Absichten und reale Erfolgskriterien klären.
  Bestehende Runtime-/Manifest-Bausteine nutzen; Erzählen erzeugt keinen Zustand.
- Einen eigenen versionierten Ideen-/Erzählvertrag definieren. Verbindliche Fakten,
  kreative Freiräume und Feldperspektiven ausdrücklich benennen. Private Rollen
  nicht unverändert auf professionelle oder operative Missionen übertragen.
- Kontext auf glaubwürdige Möglichkeiten ausrichten. Bei Drift zuerst Datenanker,
  Profil, Klassifikation und Übergaben prüfen, bevor neue Prosa-Verbote entstehen.
- Eine kompakte KI-Memory im bestehenden Aufruf mitliefern lassen. Für das neue
  Set passende Vergleichsdimensionen definieren; Speicher- und Migrationsvertrag
  ausdrücklich festlegen, statt private History ungeprüft global einzusetzen.
- Picker und Direktpfad müssen denselben Ideenvertrag verwenden. Auswahl bewahren.
  Fortsetzungen brauchen eigene Abschlussnachweise und eine eigene Erzählphase.
- Wenige gezielte Live-Versuche, mehrere Kontexte und aufeinanderfolgende Entwürfe
  betrachten. Motive, Initiative, Namen, Einstieg, Schluss und konkrete Details
  vergleichen. Nutzerbeispiele nicht dauerhaft in Produktionsprompts übernehmen.
- Tests an Übergängen ansetzen: echter Dispatcher-Einstieg, Picker-Auswahl,
  Speichern/Laden, fehlende optionale Felder, Folgeangebot, Sim- und Live-Aufrufpfad,
  Pause/Reset, doppelte Trigger und Voice-Sperren. Fixtures belegen Integration,
  nicht literarische Qualität oder einen tatsächlich geflogenen Simulatorlauf.

## Referenzen und Einstieg im Code

- [Narrative Design Guide](Mission%20Narrative%20Design%20Guide.md): Begründungen und Entwicklung.
- [Episode Writer V6](Mission%20Episode%20Writer%20V6.md): Ideen-/Writer-Pipeline und Memory.
- [Private Return](Mission%20Private%20Return%20V1.md): Abschluss, Folgeangebot und Voice.
- [Flow Reference](Mission%20Flow%20Reference.md), [Building Instructions](Mission%20Building%20Instructions.md),
  [Semantics V4](Mission%20Semantics%20Rules%20V4.md): verbindliche fachliche Grenzen.
- `mission-private-episode-v6.js`: Prompts, History, Picker-Vertrag, Writerformat.
- `mission-private-return-core.js`: Folgeangebot, Rückblick, Voice-Erzählkontext.
- `app.js`, `mission-followup.js`: Generierung, Auswahl und UI-Orchestrierung.
- `mission-runtime-core.js`, `sync.js`: Abflugtrigger und Sim-/Live-Aufruf.
- `passenger-voice.js`: Gesprächskontext, Queue und Sprachausgabe.
