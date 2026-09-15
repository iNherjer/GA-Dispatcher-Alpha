# Missionslogik in den Tracker übertragen

Stand: 15.09.2026. Arbeitsgrundlage für die nächsten Missionsfamilien.

Verbindliche Basis: [Authority-Vertrag](Mission%20Runtime%20Authority%20Contract.md),
[Flow-Referenz](Mission%20Flow%20Reference.md),
[Building Instructions](Mission%20Building%20Instructions.md) und
[V4-Semantik](Mission%20Semantics%20Rules%20V4.md).
Konkrete Vorbilder: [APT-Paritätsaudit](Tracker%20Standalone%20Parity%20Audit%202026-09-08.md)
und [POI-Implementierung, Abschnitt 13](POI%20Tracker%20Migration%20Implementation.md#13-vollständiger-standard-poi-anschluss).

## 1. Erst den tatsächlichen Ablauf erfassen

Für jede Familie vor dem Umbau eine Tabelle anlegen: Originalfunktion, Aufrufer,
Eingaben, veränderter Zustand, Seiteneffekte, Timer, Persistenz und Testnachweis.
Ein Prompt-Builder allein beschreibt weder seinen Trigger noch seine Abbruchregeln.
Ein vorhandener gemeinsamer Handler beweist noch nicht, dass das neue Rezept ihn erreicht.

Mindestens erfassen:

- Vorbereitung, Boarding, Manifest, Start und falscher Startort.
- Flugnachweis, Recorder, Komfort, Arbeitsgebiet, Zwischenlandung und Wiederstart.
- Erfolgsbedingung, Abbruchbedingung, erlaubter Abschlussort und Folgeauftrag.
- Manuelle PAX, Equipment, Schäden, Abwurf, Signatur und Zuladung.
- Vorbereitung des Abschiedstexts, tatsächlicher Abschied, Aussteigen, Abschluss.
- Reload, Verbindungstrennung, konkurrierende Geräte, Reset, Clear und Ersatzmission.

**Erfolg und erlaubter Abschluss sind unterschiedliche Fragen.** Standard-POI kann
auch unerledigt oder abgebrochen nach ausreichendem Flugnachweis am Boden beendet
werden. Heimatnähe ist separat (0,35 NM); eine Ausweichlandung kann einen Heimflugwunsch
auslösen. Eine APT-Ankunftsprüfung gegen das POI-Arbeitsziel wäre falsch.

Auch ungewöhnliche Originalregeln erhalten: POI-Dwell 0 wird beim Eintritt vor der
Höhenprüfung erfüllt. Bei fehlgeschlagenem POI-Abschluss wählt die App einen festen
Abschiedstext. Die vorhandene Priorität eines bestätigten POI-Erfolgs im
Abschiedstext wird durch die Migration nicht neu definiert.

## 2. Originalkern und eigene Anbindung

1. Originalfunktionen vor der Änderung als unveränderliche Testreferenz sichern.
2. Funktionen herauslösen; Browserzustand, Uhr, Zufall und Recorder explizit injizieren.
3. App-Adapter und Tracker-Adapter getrennt halten. Gemeinsame Fachregeln verwenden.
4. Bei generiertem Code Quellfunktionen und Generator nennen; `--check` muss Drift erkennen.
5. Original und neue Anbindung mit denselben Samples/Inputs vergleichen, einschließlich
   Zwischenzuständen, Reihenfolge, Text, Memory, Verzögerung und Nebenwirkungen.
6. Fachliche Regeländerungen nicht in einer vermeintlichen Paritätskorrektur verstecken.

POI-Vorbilder: `mission-poi-task-core.js`, `mission-poi-voice-core.js`,
`mission-poi-lifecycle-core.js` und die Generatoren unter `tools/`.
`extract-original-function.mjs` prüft Funktionsgrenzen mit dem JavaScript-Parser,
ohne App-Code auszuführen. Nachfolgende `window`-Registrierungen gehören nicht
ungeprüft in den Fachkern. Die eingefrorenen Testreferenzen werden nicht mitgeneriert.

Ab Tracker v409 steuert der gemeinsame Alpha-Schalter alle ausdrücklich
freigegebenen Rezepte. Pro neue Missionsfamilie bleibt eine eigene fachliche
Freigabe nötig; es wird kein weiterer Benutzer-/Umgebungsschalter eingeführt.
[Bedienung und Kompatibilitätsvertrag](Tracker%20v409%20Mission%20Authority%20Switch.md).

## 3. Vollständiges Rezept vor Authority-Übernahme

Ein versioniertes Rezept bindet Mission-ID, echte TaskDomain, Originalparameter,
Task-/Home-Anker, Schwierigkeit und explizite Varianten. Der Adaptername reicht nicht.
Spezialtypen (z. B. SAR, Training, Survey, Kette, Bush) bleiben gesperrt, bis ihr
jeweiliger Vertrag vollständig ist.

Der Seed enthält außerdem:

- Originale Szenenkommandos, Cargo-Assets, Equipment-Schlüssel, PAX-Kommandos und Audio-Cues.
- Originale Voice-Kontexte mit Persona, Fakten, Wetterbriefing, Modell-/Audioeinstellungen.
- Explizit `none` für eine tatsächlich leere Szene; fehlendes Rezept ist kein Erfolg.
- Aufgelöste Zielszene inklusive Terrain. Fehlende Terrainbasis zuerst beschaffen;
  keine Ersatzhöhe erfinden. Zielszene am festen Zielanker, Boarding am Live-Flugzeug.

Große Kontextdaten einmal speichern und referenzieren. Bei POI verweist das Farewell
auf den Voice-Kontext im Ausführungsrezept; Flugansagen erhalten nur ihre benötigten
Felder. Nach dem Handoff erzeugt der Tracker keine neue Persona aus Klassifikationsheuristiken.

APT-Handoff ist **Preflight-only**: `planned`, Execution-Revision 0, keine Effekte.
POI folgt demselben Vertrag. Änderungen an der Planned-Payload müssen den Seed
aktualisieren; alte Ergebnisse dürfen ihn nicht vergiften. Midflight-Handoff ist
keine bereits durch APT zugesicherte Fähigkeit.

## 4. Authority, Persistenz und Ressourcen

- Ein Run entscheidet; alle Geräte senden Intents und zeigen bestätigte Projektionen.
- Revision/Hash/Run-ID vor Mutation prüfen. Nur eine eigene bestätigte Flush-Revision
  darf einen bereits geprüften Intent intern anheben. Kein pauschales Akzeptieren alter Revisionen.
- Navigation hat eine eigene Revision und verändert weder Taskanker noch Fachfortschritt.
- Semantische Übergänge und ihre Effekte atomar speichern; Effekt-IDs bleiben stabil.
- POI-Rohsamples bleiben lokal im RAM. Regelmäßige Checkpoints wie beim APT-Kontext
  alle fünf Sekunden; Übergänge, Intents und Disconnects werden vorher gesichert.
- Ein fehlgeschlagener Schreibvorgang behält den ausstehenden Zustand samt Effekten.
  Neue Samples dürfen ihn nicht durch eine neue Interpretation ersetzen.
- Taskzeit, Recorder und Timer bei Pause/Reconnect kontrolliert fortsetzen. Offlinezeit
  darf keine Taskarbeit erledigen. Reload ist weder Reset noch Missionsabbruch.
- Journal nach spätestens 160 Events checkpointen; wartende Effekte und begrenzte
  Duplikatbelege erhalten. Kein vollständiges Replay für jedes Sample/Event.
- Grenzen: Resume-Bundle 384 KiB; gesamter Cloud-Upload 256 KiB. Seed, Manifest,
  wartende Sprachrezepte und wachsende Historie gemeinsam testen, nicht nur den Detektor.

## 5. Gemeinsame Tracker-Bausteine tatsächlich anschließen

| Baustein | Zu bewahrender Vertrag / Nachweis |
| --- | --- |
| Recorder | Start-/Airborne-Nachweis, Pausen, Zwischenlandungssegmente, Touchdown-Fakten, Abschlussdatensatz und Bordbuchzeit. Keine Flugbewertung aus unzureichenden Samples erfinden. |
| Allgemeine Voice | Originalguards für Komfort, falschen Start, Fortsetzung und Landung; Taskansagen ersetzen sie nicht. POI-Endbereitschaft verhindert eine falsche APT-Landeortwarnung. |
| Voice-Persistenz | Generierten POI-Text und narrative Memory vor TTS bestätigen. Schreibfehler pausiert TTS; Retry nutzt denselben Text. Text ist auch bei stummem/fehlgeschlagenem Audio sichtbar. |
| Audio | Bestehende globale Playback-Lease, Gerätewahl, Job-IDs und begrenzten Download verwenden. Keine zweite Audiokoordination pro Missionstyp. |
| PAX | Originalkommandos mit 2 s Türöffnungs-/1 s Türschließwartezeit, Busy-Sperre, 70-s-Timeout und wiederholbarem Recovery. Rollback stellt das Item wieder her, nicht eine invalidierte Signatur. |
| Cargo | Reale Objekt-/Payload-Effekte zusätzlich zur Manifestmutation; monotone `objectRevision`, stabile Equipment-Schlüssel, Gegenaktionen zusammenfassen. Cues ohne TTS-Key testen. |
| Farewell | Prewarm auf privater Kopie. Vor Ausgabe aktuelles Cargo-/Taskergebnis prüfen. Unveränderter Text wiederverwenden, veralteten Prewarm verwerfen. Touchdown-Wetter darf eingefroren bleiben. |
| Close | Nach bestätigtem Entladen automatisch fortsetzen; Neustart vor Dispatch und nach Close-ACK genau einmal abschließen. Recorder vor Finalisierung laden; bei Schreibfehler Run behalten und gedrosselt wiederholen. Abgebrochene Benutzerbestätigung sendet keinen Intent. |
| Cleanup | Payload-Baseline inklusive Equipment/PA-24 und Szenen vor Freigabe des Runs bereinigen. Fehlgeschlagenes Cleanup erhält Authority und Wiederholbarkeit. Reset behält Auftrag, Clear entfernt ihn. |
| UI | Eigene Status-/Endtexte; gemeinsame Cargo-, Signatur-, Busy- und Fensterbausteine. Zwei Geräte sehen dieselbe Revision, dieselben Texte und erlaubten Aktionen. Spätes ACK startet keine Signatur-/Textanimation erneut. |

Langsame Sprachgenerierung darf unabhängige Cargo-/Payload-Effekte nicht blockieren.
Die POI-Taskansagen bleiben untereinander geordnet. Ein Leerlauf-Flush vor einem
Intent darf keinen konkurrierenden leeren Effektlauf starten und dadurch dessen
anschließenden Dispatch verschlucken.

## 6. Testmatrix und Freigabe

Jede neue Familie bekommt mindestens:

1. Original-Differentialtests für Erfolg, Fehlschlag, fehlende Daten und Grenzwerte.
2. Vollständigen Lauf über echte Authority, Adapter und Effect-Runner; Simulator-I/O
   darf im Unit-Test ersetzt werden, fachliche ACKs nicht manuell übersprungen werden.
3. Cargo/PAX/Equipment, beschädigte/fehlende Pflichtitems, schnelle Gegenaktionen,
   Türfehler, Timeout und Signatur-Rollback.
4. Absturz vor Entladebestätigung, direkt danach, zwischen Text und TTS sowie nach
   Close-ACK; verspätete/duplizierte Antworten und Ersatz-Run.
5. Zwei unabhängige UI-Projektionen, Revisionskonflikte, späte ACKs, Reconnect und
   Capability-Lücke; keine zweite lokale State Machine.
6. Großen Seed und langen Lauf mit wartenden Effekten, Kompaktierung und Diskfehlern.
7. APT-Regressionen der benutzten gemeinsamen Bausteine.
8. Gesonderten Feldnachweis: MSFS-Szenen, PA-24-Zuladung, Desktop-Audio und zwei Geräte,
   App geschlossen, Neustart/Trennung sowie fehlgeschlagener Abschluss.

Code-, Mock-Simulator- und Feldnachweise getrennt ausweisen. Erst alle nötigen
Einstiege gemeinsam freigeben: Seed, Cloud-Kandidat, Manager, Runtime, Effektplan,
UI und Capability. Ein internes Teilrezept darf keine Produktions-Capability erhalten.
Additive Alpha-Funktionen erfordern keine Anhebung der Stable-Mindestversion.
Tracker-Build/Release folgen dem [Push-Workflow](github-push-workflow.md).

EFB-Debrief, Flightlog-Explorer/Export und ein neues Cloud-Langzeitlog sind im
APT-Plan nachgelagert. Sie werden nicht nachträglich zu Migrationsblockern erklärt;
korrekte Abschlussdaten und das bestehende App-Debrief bleiben Pflicht.

## 7. Zusätzliche Lehren aus der Verdrahtungsprüfung

- Tests direkt am Detektor reichen nicht: Pause-/Menüstatus muss durch alle vorgeschalteten Adapter bis zum Suspend-Pfad gelangen.
- Zeitfenster und Mindestzahl der Samples gegen die tatsächliche produktive Zuführungsfrequenz prüfen. Ein 250-ms-Test beweist keine Funktion bei 500-ms-Eingang.
- Bestätigte Projektionen exakt übernehmen; heuristischer Legacy-Restore darf explizite Tracker-Felder nicht umdeuten.
- Automatische Trigger und manuelle Sprachaktionen getrennt inventarisieren. Eine gemeinsame Audio-Lease ersetzt keine autoritative Prompt-/Intent-Ausführung.

- Bewegungsdaten vor dem Relay-Throttle lokal sammeln; Originalschwellen erhalten. POI/APT verwenden jetzt dasselbe begrenzte 3,5-s-Fenster mit höchstens einem Sample je 100 ms. Keine höhere Netzwerk- oder Schreibfrequenz dafür einführen. Pause, ungültige Samples, Quelllücken und Runwechsel leeren den Puffer.
- Pause auch ohne GPS-Position durch den produktiven SimConnect-Einstieg schicken. Suspend-Persistenz nur beim Übergang beziehungsweise Retry; keine dauernden Disk-Schreibvorgänge während der Pause.
- Manuelle Aktionen durch die echte Cockpit-Intent-Allowlist, Authority-Prüfung und Effektwarteschlange testen. Vorflug, konkurrierende Geräte, Duplikate, Neustart und Abbruch gehören zum Vertrag.
- Sichtbare Textantwort am tatsächlichen UI-Einstieg prüfen. Ein `voice.text`-Feld im Snapshot beweist noch keine Anzeige. Bestätigten Text ohne HTML-Interpretation anzeigen; spätes ACK darf einen geschlossenen Hinweis nicht erneut öffnen.
- Statische Kartenbezüge beim Seed mit dem Originalbuilder auflösen; keine vollständige Städtedatenbank an den Tracker übertragen. Dynamische Position/Höhe und bestätigten Taskzustand beim Intent aus der Tracker-Runtime beziehen.

[POI-/APT-Befunde und Reproduktionen](POI%20Tracker%20Migration%20Implementation.md#14-erneute-verdrahtungsprüfung-noch-offene-abweichungen),
[Korrekturen und Regressionen in v406](POI%20Tracker%20Migration%20Implementation.md#15-korrekturen-vor-dem-ersten-feldtest-v406).
