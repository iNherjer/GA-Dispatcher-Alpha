# Mapping/Survey: Umbau und Authority-Prüfung

Stand: 30.09.2026. Analyse auf Basis von Commit `5d0b41f3a`;
der neue Mapping-Writer und die additive Erzählübergabe sind lokal implementiert, noch nicht veröffentlicht.

## Verbindlicher Rahmen

Professioneller Aufnahmeauftrag mit mitfliegender Fachperson. Bestehende
Mapping-Zielauswahl umfasst Infrastruktur, Industrie, Bahn, Straße, Brücke
und Staudamm. Gebäude und künstliche Bauwerke sind fachlich gültige Ziele;
keine neue private Fotofamilie und keine automatisch behauptete Schadensdiagnose.
Ideen entstehen ohne konkrete Szenariolisten im Prompt. Frühere Auftragskerne
dienen als History. Szenen dürfen unterstützen, sind aber optional.

Das bestehende `ga.surveyPattern.v1` bestimmt Arbeitsbereich, Höhenband,
Nord-Süd-Linien oder Orbit und Erfolgskriterien. Der Writer erklärt diesen
Vertrag, ersetzt ihn aber nicht. Vollständiges Flugmuster beweist keine
kalibrierte Messung, geprüfte Datenqualität oder tatsächliche 3D-Auswertung.

## Vorhandene eigenständige Tracker-Ausführung

- Resume-Adapter `survey_pattern`, Ausführungsrezept `poi`, Domain
  `mapping_survey`: verschiedene Identitäten, die gemeinsam erhalten bleiben müssen.
- `tracker-mission-poi-runtime.js` bewertet den Survey vor dem allgemeinen
  POI-Ablauf; kein Ersatz durch reine Verweilzeit.
- `tracker-mission-survey-task.js` nutzt den generierten Original-Survey-Core.
  Scan-Fortschritt und Orbit-Detektor liegen im Authority-Zustand `surveyState`.
- `tracker-mission-survey-voice.js` bewahrt Status-, Orientierungs- und
  Ereignisansagen. Voice-Kontext und Muster müssen am Rezept übereinstimmen.
- App und gepackte EFB-Karte verwenden `renderAuthorityProjection(surveySpec,
  poiTask.surveyPattern)` zur Darstellung. Bei Tracker Authority erfolgt dort
  keine zweite Mustererkennung.
- Infrastruktur-Folgeangebote werden beim bestätigten Abschluss im Tracker
  erzeugt. Abschluss und Follow-up-Outbox verwenden die vorhandene gemeinsame
  Transaktion; die offene Browser-App ist dafür nicht erforderlich.

## Anschlussstelle für den neuen Writer

Die bisherigen neuen POI-Familien schließen `followupSeed` und POI-Ketten in
ihrem eigenen Browser-Generator aus. Dieses Muster darf Mapping nicht blind
übernehmen: Mapping kann aus Infrastruktur-Inspektion oder Kettenaufklärung
entstehen und selbst Reparatur-Fotodokumentation nach sich ziehen.

`mission-infra-outcome-core.js` enthält den gemeinsamen Auftrag-/Fortsetzungsrahmen
für Mapping, Reparaturfoto und Nachprüfung, einschließlich Legacy-Prosa,
Personen, `narrativeMemory`, Zielreferenzen und zeitlichem Kontext. Neue Prosa
muss diesen fachlichen Rahmen verwenden und bereits bekannte Beteiligte,
Befunde sowie offene Fragen erhalten. Versteckte Befunde bleiben verborgen;
geplante Arbeiten werden nicht als bestätigtes Ergebnis ausgegeben.

Die additive Erzählübergabe an diesem gemeinsamen Pfad betrifft mehrere
Familien. Die explizite Freigabe gemäß AGENTS.md wurde am 30.09.2026 erteilt. Freigaben für
Folgeprofile, Kettentiefe, Flugmuster und Cargo-Erfolg werden dabei nicht geändert.

## Implementierung und Übergabe

`mission-mapping-briefing-core.js` erzeugt freie professionelle Auftragsideen,
Briefing und Begrüßung. `mission-mapping-briefing-browser.js` bindet Picker,
Direktgenerierung und eingehende Folgeaufträge ein. Der Writer erhält das mit
Original-App-Funktionen berechnete Survey-Muster einschließlich Arbeitshöhe.
Der bestehende Szenen-Composer verwendet einen optionalen SceneIntent.

`mission-poi-followup-narrative-core.js` speichert `ga.followup-narrative.v1`:
Zusammenfassung, Beteiligte, Auftraggeber, offene Fragen und mögliche Fortsetzungen.
Memory ist auf 4000 JSON-Zeichen begrenzt, der gesamte Übergabevertrag auf 8000.
Diese Angaben sind keine neuen fachlichen Befunde oder Ausführungsbefehle.
Ein ungültiges optionales Memory verwirft kein ansonsten gültiges Briefing;
ältere Aufträge verwenden einen ausdrücklich als Legacy markierten Kontext.

Erst der bestätigte Abschluss ergänzt Abschluss-ID und Erfolgsbeleg. Früh im
App-Abschluss angelegte Alt-Anfragen erhalten den Beleg anschließend ohne neue
Anfrage, geänderten Termin oder neues Gate. Fremde Abschluss-Identitäten und
fehlgeschlagene Abschlüsse werden nicht als Beleg übernommen.

Mapping, Reparaturfoto und Nachprüfung führen bekannte Geschichte und Befund
weiter. Die ursprünglichen Follow-up-Profile, Kettentiefe und Cargo-Regeln bleiben
zuständig. Ein eigenständiger Mapping-Auftrag bekommt durch eine erzählerische
Anschlussidee keine automatische Freigabe für eine neue Mission.

Lokale und Cloud-Kompaktformate bewahren Briefing, Memory, Zielkategorie und
Fortsetzungsfelder. Der Resume-Adapter transportiert den Survey-Vertrag; der
serialisierte Voice-Basiskontext trägt die Geschichte in die bestehende
Tracker-Voice-Ausführung. Die History merkt zwölf tatsächliche Auftragskerne
mit insgesamt maximal 16000 Zeichen und enthält keine festen Szenariobeispiele.

## Ausgeführte Prüfungen

109 Fälle im breiten Lauf: 108 bestanden, ein lokaler HTTP-Test wurde zunächst
von der Sandbox blockiert. Separat außerhalb der Sandbox bestanden alle elf
Tracker-Kindprozess-Tests. Danach bestanden alle 13 Mapping-Tests einschließlich
der zusätzlich geprüften beschädigten Memory- und Abschluss-Identitätsfälle.

Geprüft sind Original-Geometrie und Höhenberechnung, Picker ohne Neuauswahl,
Folgeauftrag-Kontext, tatsächliche Kompaktserializer/Resume-Adapter, Voice-Kontext
sowie die bestätigte Kette Inspektion → Mapping → Reparaturfoto → Nachprüfung.
Der reale Mapping-Kindprozess-Test prüft Muster, Fortschritt, manuelle Statusabfrage
und Erzählgedächtnis über die Worker-Grenze. Die Selbsttests für Resume-Adapter,
Survey-Muster, POI-Ketten und 432 eingefrorene Ketten-Voice-Ereignisgruppen bestehen.

Kein MSFS-Feldtest, visueller Kartenvergleich oder Nachweis hörbarer TTS-Ausgabe.
Nach ausdrücklicher Freigabe wurden drei Missionen live mit Google Gemini getestet.
Vorläufe zeigten Szenenschema-, Perspektiv- und Referenzfehler; nach gezielten
Prompt-Korrekturen und einem tatsächlichen Mapping-Höhenbinding lief der letzte
Batch mit drei Writer-Aufrufen vollständig durch. Alle drei Memory-Verträge
wurden akzeptiert. Wetter/Terrain waren gekennzeichnete Testwerte, die Brücke
ein synthetisches Testziel. Kleine Sprachschwächen bleiben dokumentiert.
Texte und Ergebnisse: [Live-Probe](../analysis/mapping-live-20260930.md).

## Veröffentlichung

Die vorhandene Survey-Ausführung ist bereits Tracker Authority. Die neue
Erzählübergabe verändert gemeinsam verpackte Tracker-Abhängigkeiten und benötigt
vor Veröffentlichung einen neuen Tracker-Build samt Release-Asset. Der bisher
veröffentlichte Tracker enthält diese neue Übergabe noch nicht. App und Tracker
müssen als zusammengehöriger Stand veröffentlicht werden; noch kein Push erfolgt.

## Sprachliche Nachschärfung

Promptstand `mapping-assignment-v2` erklärt Bahnen/Kreise in natürlicher Sprache,
fordert Höhenangaben mit Fuß und MSL und trennt Rohaufnahmen von späterer
Qualitätsprüfung. Drei weitere Live-Missionen wurden vollständig erzeugt;
alle Höhen enthielten Einheit und Bezug. Noch offene Detailansprüche an eine
unbestimmte Kameraleistung sind in der [verfeinerten Probe](../analysis/mapping-live-20260930-polish.md)
dokumentiert. Keine nachträgliche semantische Textkorrektur eingeführt.
