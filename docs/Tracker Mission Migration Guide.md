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
- Grenzen: Resume-Bundle 384 KiB; persoenlicher Cloud-Sync V2 maximal 8 MiB
  dekodiertes UTF-8-JSON, maximal 96 KiB je POST-Body. Die fruehere
  256-KiB-Grenze gehoert zum Legacy-Transport, nicht zu V2. Seed, Manifest,
  wartende Sprachrezepte und wachsende Historie gemeinsam testen, nicht nur den Detektor.
  Siehe `Cloud Profile Sync V2.md` und `POI Gate Coverage Audit.md`.

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

## Feldtest-Fixes vom 15.09.2026 (Tracker v410)

- Cloud-Seeds enthalten absichtlich keine Live-Telemetrie. Auch vor `MISSION_STARTED`
  muss der Tracker Boden-/Stillstandsdaten verarbeiten. `PREFLIGHT_GROUND_OBSERVED`
  aktualisiert nur `onGround`/`groundStill`; keine Flugphasen, Landung, Recorder-
  oder Voice-Effekte. Wiederholte unveraenderte Samples schreiben nichts; alte
  Samples werden verworfen. Rollen, Offground, Pause/Menu und ungueltige
  Geschwindigkeit sperren die Bodenaktionen. Gilt gemeinsam fuer APT und POI.
- Projektionen muessen Manifest-Metadaten erhalten: `pilotId` und `aircraftLabel`
  werden ins EFB uebertragen; die Signatur verwendet vorrangig die Pilot-ID des
  autoritativen Manifests. Ein Display-Fallback darf keine echte Identitaet ersetzen.
- Freigegebene Tracker-Payload-Policy: bei Vorbereitung erzeugt `syncInitialPayload`
  einen dauerhaften `payload.sync_manifest_state`-Effekt. Der Simulatorhandler
  verwendet `replaceNonPilotPayload`: Pilotstation 1 und Fuel bleiben erhalten,
  alle Nicht-Pilot-Gewichte ergeben sich aus den geladenen Manifestpositionen,
  einschliesslich geerbter persistenter Ausruestung. Pending Cargo bleibt bei 0.
  Weitere Ladeaenderungen verwenden denselben Sollstand, keine Addition zur
  versehentlichen Sim-Beladung. Die originale Baseline bleibt fuer Recovery erhalten;
  bestehende Wiederherstellung bei Abort/Reset bleibt bestehen. Standalone-Aufrufer
  ohne diese Optionen behalten ihre bisherige additive Payload-Policy.
- PA24: bei Ersatzpolicy volle Sitz-/Charakter-/Gepaeckwerte schreiben. Die originale
  Recovery-Baseline ist kein gueltiger Vergleich fuer spaetere Schreiboptimierungen.
  Bestehende Readback-/Stabilisierungspruefungen bleiben aktiv; reale Ueberladung
  und zu viele Manifestpassagiere bleiben Fehler.
- EFB/Toolbar: direkter Button `Audio auf PC ausgeben` zusaetzlich zur vorhandenen
  Auswahl. Er benutzt `settings_update` mit zentraler Revision und `target.mode=pc`;
  keine zweite Playback-Autoritaet. Die bestehende zentrale Lease beendet die
  bisherige Ausgabe. Ein laufender Clip kann beim Wechsel neu beginnen.

Regressionen: Cloud-Start ohne Live-Seed, Bewegungs-/Pause-Gegenfaelle,
Manifestprojektion und Signatur, voller PA24/Standard-Sim, wiederholtes Laden/
Entladen mit unveraenderter Recovery, initialer Payload-Effekt genau einmal,
PC-Button. Payload-Standalone-Differentialtest weiterhin unveraendert bestanden.
Realer MSFS-Feldtest der neuen Version bleibt erforderlich.

## Feldtest-Fixes vom 16.09.2026 (Tracker v411)

- **Pilotidentitaet am echten Einstieg testen:** Das originale App-Manifest hat
  normalerweise keine `pilotId`; die App liest `ga_sync_id`. Ein Testmanifest mit
  erfundener `pilotId` hatte den Fehler in v410 verdeckt. Tracker nutzt jetzt seine
  authentifizierte Sync-ID beim Cloud-Seed, Signieren und in der EFB-Projektion.
  Nur alte technische Signaturen `Tracker` werden in der Anzeige korrigiert;
  echte Signaturen und gespeicherte Historie bleiben erhalten. Kein PIN im Seed.
- **Vollstaendige Runtime statt nur Detektor testen:** Der POI-Lifecycle verglich
  JSON-Strings, obwohl der gespeicherte Core die Schluessel anders sortiert.
  Identische Flags erzeugten deshalb alle 500 ms eine neue Authority-Revision.
  Jetzt werden die vier fachlichen Werte verglichen. Eine Minute mit 120 Samples
  durch den echten Adapter erzeugt 15 statt 134 semantischer Commits; Lifecycle-
  Events sinken von 120 auf 2. Task-Checkpoints bleiben bei 12 (5 s), kritische
  Uebergaenge und atomare Persistenz unveraendert. Replay-Hash muss identisch sein.
  Der Fehler bestand bereits vor v410. Dies erklaert Schreiblast, beweist aber
  noch nicht die vollstaendige Behebung der bis zu 18 s langen Windows-Loop-Lags.
- **Karte im Browser pruefen:** Ein nicht definiertes `escapeHtml` im POI-Popup
  brach den Routenaufbau ab. Sicherer DOM-Text ersetzt den Aufruf. Neue Layer
  werden erst erfolgreich aufgebaut, bevor alte verschwinden; die Signatur wird
  erst nach erfolgreichem Zeichnen bestaetigt. Test: Fehler gezielt ausloesen,
  alte Route behalten, identischen Snapshot erneut erfolgreich zeichnen.
- **PAX bleibt Projektion:** Wieder aufklappbares Fenster fuer den letzten
  bestaetigten Text und Sprecher, wie das originale App-Lesefenster. Bestehende
  POI-Intents `poi_status`/`poi_orientation` liegen dort und behalten ihre Gates.
  Kein zweiter Voice-Trigger, keine eigene Missionslogik. APT-Texte sind lesbar;
  weitere App-PAX-Aktionen (z. B. Wetter/Wohlbefinden) werden dadurch nicht neu
  freigeschaltet. Runwechsel leert die Anzeige; Polling oeffnet sie nicht erneut.
- **Transport und Darstellung trennen:** Ein Renderfehler darf keine
  Verbindungs-Recovery ausloesen. Snapshot-Deadline 5 s bei 1,5 s Server-Longpoll;
  nach erfolgreicher Verbindung bleibt bei einem einzelnen Timeout das letzte
  Bild mit Verzoegerungshinweis stehen. Zwei Fehler oder 10 s ohne Erfolg melden
  offline, anfaenglich fehlende Verbindung sofort. Retry nach 1 s. Echte Fehler
  und Nebenabfragen werden mit Ursache protokolliert.

Nachweise: 314 Tracker-/EFB-Tests; Browser-Regressionsprobe
`tools/efb-field-regression-ui-selftest.cjs` (mit Electron starten; nur lokaler
HTTP-Verkehr, Screenshot unter `/tmp/efb-field-regression.png`); originale
POI-Lifecycle-/Cargo-/Action-/Voice-Differentialtests und Payload-App-Vergleich.
Realer Windows-/MSFS-Wiederholungstest mit v411 bleibt erforderlich.

## Anzeige-Paritaet aus v412

- Ein gueltiger Zahlenwert 0 darf nie durch `|| 100` zum gesunden Default werden.
- Health nicht aus einem historischen App-View uebernehmen, wenn das aktuelle
  Tracker-Manifest verfuegbar ist. Beide Anzeigen mit echtem Runtime-Stress testen.
- Aktuell an Bord, bereits transportierte Pflicht-Items und Gesamtbedarf sind
  verschiedene Zaehler; optionale Items nicht als erfuellte Pflicht zaehlen.
- Bei PAX genau eine Textanzeige, ungelesen-Badge und gespeicherte Position;
  neue Nachricht/ACK darf ein geschlossenes Fenster nicht automatisch oeffnen.

## Verlustfreier Cloud-Start (v413)

Fuer weitere Missionsfamilien gilt [Cloud Profile Sync V2](Cloud%20Profile%20Sync%20V2.md).
Mission und Tracker-Seed bilden einen atomaren Abschnitt; keine Groessenreduktion
von Seed, MissionTruth, Zielkontext, Cargo oder Voice. Transportfehler sind kein
Beleg fuer eine leere Cloud-Mission. Bestehende Adapter und Authority-Gates bleiben
zustaendig. Der Tracker liest Mission/Metadaten selektiv und cached gepruefte Teile.

## Live-Anzeigen nach dem Handoff (Feldtest v415)

Nicht nur Cargo-Kachel und Phase testen: alle Zeilen in Fortschritt, Anforderungen,
Feedback und Zielnavigation mit einem absichtlich veralteten App-Seed pruefen.
`efbMission` im Resume-Bundle ist keine laufende Wahrheit. Pflichtmanifest und
Arbeitszeit muessen denselben autoritativen Zustand wie Ladefenster und Detektor
verwenden. Entladen/uebergeben darf unter „an Bord“ nicht mitgezaehlt werden.
Snapshot-Projektion darf den Seed oder die Missionsregeln nicht mutieren.

## Komfortwertung und Feedback (v416)

Voice-Trigger fuer Beschwerden und die numerische Komfortwertung sind getrennte
Funktionen: ein funktionierender Voice-Trigger beweist keine laufende Score-Anzeige.
Originalwertung via `tools/generate-mission-comfort-core.mjs` extrahieren;
`tools/mission-comfort-selftest.mjs` vergleicht echte Samplefolgen. Ereignisflags
mitpersistieren, damit ein anhaltendes Ereignis nach Restore nicht neu zaehlt.
Keinen ganzen Seed pro Telemetriesample kopieren; nur benoetigte Kontextfelder
beim Run-Wechsel holen. Keine Extra-Schreibfrequenz fuer UI-Werte einfuehren.
Fehlende Messung nicht als 100 % anzeigen. Cargo-Blocker von der ausfuehrenden
Pruefung uebernehmen; an Bord, entladen und fehlend sind unterschiedliche Begriffe.

## PAX-Fundament und private APT-Heimreise (v417)

Siehe [v417](Tracker-v417-Release.md). Manuelle Abfragen werden aus den originalen
Standalone-Funktionen generiert (`generate-mission-pax-query-core.mjs`). Verfuegbarkeit
muss sowohl in der Projektion als auch vor Ausfuehrung aus aktuellem Tracker-Zustand
geprueft werden. Keine manuellen App-Voice-Aufrufe neben Tracker-Autoritaet.

Neue App-Trigger ausserhalb `passenger-voice.js` gehoeren ebenfalls zum Audit:
Der private Abflugtrigger lag in `mission-runtime-core.js`/Recorder und fehlte deshalb
im Tracker trotz vorhandener Boarding-/Arrival-Texte. Im Tracker aus beiden Originalen
generiert; Pause vor dem fruehen Telemetrie-Return behandeln. Einmaligkeit aus
persistierten Effekten rekonstruieren, nicht nur aus einem fluechtigen Merker.

Follow-up-Angebote bleiben ein eigener noch offener Migrationsschritt. Weder
uebertragener `followUpRequests`-Bestand noch eine erzaehlte Folgeflug-Andeutung beweisen
autonome Angebotserzeugung. Private Return: nur bestaetigte Abschluss-/Flugevidenz,
gleiche Begleitung/Route, deterministische ID und Tombstones; Infra: Originalbefund
und dessen Folgeprofil. Noch nicht migrierte Folgeprofile nicht per Gate freigeben.

## Folgeangebote und Sightseeing (v418)

Der zuvor offene Follow-up-Schritt ist umgesetzt; Details und Grenzen siehe
[Tracker v418](Tracker-v418-Release.md). Angebote mit dem Abschluss atomar in einen
pilotgebundenen Postausgang schreiben. Cloud-Bestaetigung erst nach CAS-Merge;
Retries duerfen Tombstones nicht reaktivieren. Eine uebertragene Anfrage bedeutet
weiterhin nicht, dass ihr Folgeprofil bereits vom Tracker ausgefuehrt werden kann.

UI-lastige Originalmodule koennen mit injizierbarem Host wiederverwendet werden,
solange nur UI-/Speicheradapter getrennt und fachliche Funktionen unveraendert bleiben.
Fuer weitere Wissensmissionen: akzeptierten Kontext im Seed bewahren, Original-
Faktenauswahl extrahieren, Sprachgedaechtnis vor Playback persistieren und Browser-
Replay pruefen. Sightseeing hat im Original kein „Erzaehl mal“; den Lern-Guide nicht
anhand einer aehnlichen Erzaehloberflaeche voreilig freigeben.

### Korrektur v419: optionale Daten duerfen kein neues Gate werden

Sightseeing benoetigt wie Standalone keinen Wissenskontext. v418 blockierte damit
legitime generierte Missionen bereits vor dem Cloud-Seed. Original-Prompttests
muessen auch fehlende, leere und abgelehnte Zusatzdaten abdecken; ein gueltiger
Ideal-Seed allein prueft nicht die Ausgabe der realen Generierung. Vollstaendigen
Lifecycle ebenfalls ohne Zusatzdaten testen. Siehe `Tracker-v419-Release.md`.

## v420 – gleiche Nutzdaten, unterschiedliche Transportbudgets

Siehe [Verlustfrei-Audit](Mission%20Lossless%20Transport%20Audit.md). Cloud-Limit,
lokales Resume-Limit und Relay-Frame-Limit separat pruefen. Cloud-Kandidaten erst
nach Groessenpruefung des fertigen Pakets freigeben. Keine stille Kuerzung fuer
Handoff/Export. Kleine UI-Projektionen sind keine Resume-Daten. Quota-Fallbacks
vor Export ueber den bestehenden Vault aufloesen. Oversize-Fehler sichtbar und
korreliert zur Anfrage zurueckgeben. Chunked Cloud ersetzt keinen chunked Relay.

### v421: Vollstaendige Pakete beim App-/Geraetewechsel

Grosse Authority-Snapshots und Handoffs verwenden das gemeinsame
`mission-transfer-core.js`-Protokoll in beiden Richtungen. Neue Missionsfamilien
muessen diesen Weg weiterverwenden; keine eigene Kuerzung, Teilmission oder
ungepruefte Paketuebernahme bauen. Chunk-Quittierung ist keine fachliche
Authority-Bestaetigung. Erst die bestehende Authority-Antwort entscheidet ueber
Besitz/Revision und die weitere UI-Aktion. Details, Grenzen und Testfaelle stehen
im [Transport-Audit](Mission%20Lossless%20Transport%20Audit.md#ergaenzung-v421-relay-geraetewechsel-umgesetzt).

## v436: POI Learning Guide und getrennte Loops

- Gate erweitert um `poi_learning_guide`; Survey/Mapping, POI-Ketten, Training,
  SAR und Bush bleiben an ihren spezialisierten Vertraegen gesperrt.
- Originalfunktionen aus `passenger-voice.js` werden generiert wiederverwendet:
  reichhaltige Wissensboegen, Kern-/Zusatzfakten und die manuelle Aktion
  `poi_tell_more` (»Erzaehl mal«), einschliesslich Erschoepfungsantwort.
  Ohne akzeptierte Faktenbasis bleibt der normale Flug moeglich; die manuelle
  Wissensaktion ist nicht verfuegbar. Keine neue KI-Faktenproduktion.
- Faktenbasis reist im Voice-Kontext. Manuell reservierte Fakten-IDs liegen in
  `state.voice.poiMemory.knowledgeManual`; bereits erzaehlter Text in
  `knowledgeSpoken`. Die Reservierung erfolgt mit dem Intent im Worker vor dem
  Audioeffekt, damit mehrere Clients denselben Fortschritt sehen. Auch Boarding-
  und Anflug-Voice-ACKs erfassen Lernfakten wie beim Sightseeing.
- App und EFB senden dieselbe Aktion; Verfuegbarkeit und Auswahl entscheidet die
  Tracker-Autoritaet. Der Browser fuehrt unter Tracker-Autoritaet keine zweite
  manuelle Faktenauswahl aus. Standalone nutzt weiterhin die Originalfunktion.
- Die v425+ Trennung bleibt erhalten: Telemetrie/SimConnect/HTTP/Audio im Parent,
  Missionszustand, Auswertung und Intent-Validierung im Worker. Keine neue Arbeit
  im Telemetrie-Callback, keine zusaetzlichen synchronen Writes pro Trigger.
- Vom Nutzer akzeptiert: RAM-Bestaetigung mit periodischem Checkpoint (~5 s),
  kein garantiert dauerhafter Trigger bei hartem Prozessabbruch. Ein Abschnitt
  kann dann erneut geflogen werden muessen. Normale Wiederherstellung verwendet
  die zuletzt gespeicherte Faktenliste und den bestehenden Effektschutz.

### Flugwegsegmente fuer die naechsten Familien

Der bisherige Kruemelweg verbindet gemessene Punkte grafisch; er liefert keine
zusaetzlichen gemessenen Telemetriezustaende. Die Worker-IPC fasst Positionsupdates
bei Rueckstau auf den neuesten Stand zusammen. Ihr Motion-Puffer dient Komfort
und Belastung, nicht einer vollstaendigen Survey-Flugspur.

Fuer Survey/Mapping und Ketten deshalb im naechsten Integrationsschritt kurze,
zeitlich und raeumlich begrenzte Segmente zwischen gueltigen Messpunkten pruefen.
Pause, Menue, Slew/Teleport, lange Luecken und Worker-Neustart muessen eine
Segmentkette unterbrechen. Segmentkreuzungen koennen verpasste raeumliche Trigger
abdecken; sie duerfen keine Verweilzeit, Hoeheneinhaltung, Landung oder g-Werte
erfinden. In v436 ist keine solche Fortschrittsinterpolation aktiviert.

Validierung: eingefrorene Originalfunktionen als Differentialreferenz, reichhaltige
Faktenbasis und manuelle Folge bis zur Erschoepfung; kompletter Lifecycle mit/ohne
Wissen, Replay/Restart, Browser-Replay und echter Child-Worker-Intent.


## v437: Mapping / Survey im getrennten Mission-Worker

Gate offen fuer `mapping_survey` mit validiertem `surveyPattern` (Nord-Sued-
Scanlinien und Orbit). Der Resume-Adapter bleibt `survey_pattern`; die gemeinsame
Ausfuehrungsrezept-Familie ist `poi`. Diese zwei Namen nicht gleichsetzen: Cloud,
App-Handoff, Shadow-Replay und Authority muessen beide explizit unterstuetzen.
POI-Ketten, Training, SAR und Bush bleiben gesperrt. Keine neue Klassifikation.

### Original und Anbindung

| Original | Tracker-Anbindung | Zustand / Nachweis |
| --- | --- | --- |
| `mission-survey-pattern.js`: normalizeSpec, tickScanState, tickOrbitState, tickState | generiertes `mission-survey-core.js`; `tracker-mission-survey-task.js` normalisiert Samples und begrenzt Segmente | `poiTask.surveyState`: abgeschlossene Linien/Kreise, aktive Bins/Sektoren, letzter Messpunkt; eingefrorene Originalreferenz und Differentialtests |
| `_tickSurveyPatternTask` vor gemeinsamem POI-Task | `tracker-mission-poi-runtime.js` | originale Erfuellungsflags, Cargo-Pruefung, kein Ersatz durch einfache Verweilzeit |
| `_handleSurveyPatternEvents`, Status/Orientierung und originale Survey-Texte | generierter POI-Voice-Core, `tracker-mission-survey-voice.js` | Originalprioritaet: fertig, Gebietseintritt, erstes Linien-/Orbit-/Reset-Ereignis |
| Survey-Static-Clips und Audio-Cues | zentrale Voice-Instanz im Parent | lokale WAVs aus versioniertem Katalog, originale Gemini-Stimmenauswahl, TTS-Fallback; Textbestaetigung vor Audio, bestehende Playback-Lease |
| Leaflet-Survey-Overlay | originale, fuer Coherent kompilierte Darstellung mit `renderAuthorityProjection` | App und EFB zeichnen dieselbe Authority-Projektion, ohne lokalen Detector zu ticken |
| Verladen, Start, Komfort, Rueckflug, Ausladen, Abschluss/Folgeauftraege | bestehender APT-/POI-Lifecycle | keine zweite Start-/Abschlusslogik; Lifecycle-, Restart-, Cargo- und echter Worker-Test |

### Telemetrie und Checkpoints

Der Parent liefert weiterhin latest-only Telemetrie an den Worker. Nur im
Survey-Adapter werden kurze Segmente rekonstruiert: maximal 5 Sekunden, 32
Zwischenschritte und eine Distanzgrenze aus gemeldeter Geschwindigkeit plus
GPS-Toleranz. Beide Endpunkte muessen gueltige Hoehe/Geschwindigkeit haben.
Laengengrade werden ueber den kurzen Bogen interpoliert. Das ist eine Naeherung
zwischen Messpunkten, kein Beleg fuer unbeobachtete Manoever oder Belastung.

Pause, Menue, Slew, unplausibler Positionssprung, fehlende Telemetrie, lange Luecke
und Wiederverbindung unterbrechen den laufenden Abschnitt. Abgeschlossene
Linien/Kreise bleiben erhalten; eine unterbrochene Linie bzw. Runde muss erneut
geflogen werden. Keine Interpolation von Komfort/g-Werten oder Landungsereignissen.

Checkpoint-Vergleiche muessen kanonische Objektreihenfolge verwenden. Sonst kann
Replay sortierte Event-Keys erzeugen, die faelschlich als fremde Historie gelten
und aktive Survey-Bins bei jedem Sample loeschen. Reine Voice-/Cargo-Revisionen
unterbrechen den laufenden Abschnitt nicht.

Fortschritt und Effekte gehen ueber die bestehende Revision-/Replay-Transaktion.
Keine synchronen Dateischreibvorgaenge pro Sample/Trigger: unveraenderte periodische
Worker-Persistenz, mit dem bereits akzeptierten Verlustfenster bei hartem Absturz.
Der Cloud-Seed transportiert die kleine normalisierte Pattern-Spezifikation; keine
zusatzliche Flugspur-Synchronisierung oder Worker-Write-Schleife.

### Darstellung und weitere Familien

EFB zeigt abgeschlossene Linien/Kreise und laufende Abdeckung anstelle einer
irrefuehrenden Verweilzeit. App-PAX-Status liest unter Tracker-Autoritaet dieselbe
Projektion. Geometrie, Zielhoehe, Toleranz und Cue-Overrides gehoeren zum Seed.
Der kompakte UI-Fortschritt ersetzt weder das vollstaendige Resume-Paket noch den
internen Detector. Bestehende verlustfreie Cloud-/Relay-/Exportwege weiterverwenden.

Die Tests decken Originalparitaet, unvollstaendige Samples, Pause/Slew/Teleport,
Restart, Cargo, manuellen PAX-Status, Leaflet-Projektion und den echten separaten
Worker ab. Ein MSFS-Flug bleibt fuer reale SimConnect-/Coherent-/Audio-Pruefung
notwendig.

## v438: POI-Ketten / Infrastruktur-Erstbefund

Das Gate akzeptiert `poi_chain` mit TaskDomain `infra_chain_recon`, validierter
Kettenspezifikation, passendem Voice-Kontext und dem gemeinsamen POI-Lifecycle.
Andere Spezialfamilien bleiben gesperrt. Cloud-Start und geplanter App-Handoff
verwenden dieselbe Pruefung; der Transportadapter wird auf die gemeinsame
Ausfuehrungsrecipe `poi` abgebildet.

- `mission-poi-chain-core.js` wird aus den Originalfunktionen von
  `mission-poi-chain-runtime.js` erzeugt. Reihenfolge, Punkt-Radien, Korridorbins,
  Geschwindigkeits-/Kurspruefung und Reset-Fristen bleiben erhalten. Keine neue
  Hoehenbedingung fuer Korridorsegmente.
- `tracker-mission-poi-chain-task.js` verwaltet JSON-faehige Detektorzustaende
  und kurze plausible Flugwegsegmente (maximal 5 Sekunden / 32 Schritte).
  Pause, Menue, Slew, Boden, fehlende Position, Teleport und lange Luecken
  verwerfen nur den begonnenen Korridorabschnitt. Erledigte Arbeit bleibt.
- Die originale Korridornormalisierung kann beim Tick weitere Segment-IDs
  erzeugen. Wiederherstellung muss gegen diese effektive Segmentmenge pruefen;
  eine Basis-Spezifikation allein darf nicht vorzeitig `satisfied` ergeben.
- Auswertung, Trigger und Effect-Planung laufen ausschliesslich im Mission-Worker.
  Der Parent behaelt Telemetrie-Empfang, SimConnect und Audio. Checkpoints folgen
  der bestehenden asynchronen RAM-/Persistenzstrategie, keine neue synchrone
  Dateischreiboperation je Punkt und keine Cloud-Writes je Sample.
- Die originalen Chain-Voice-Funktionen werden extrahiert, einschliesslich
  Prioritaeten bei gleichzeitigen Events und bereits erzeugter versteckter Befunde.
  Eine Beobachtung kann mehrere geordnete Texte erzeugen. Stille Segmentereignisse
  bleiben still. Status-/Orientierungsfragen nutzen die originalen Funktionen.
- Fotobursts gehoeren zum Verhalten: Anzahl, Wartezeiten, Varianten-Seed und
  Lautstaerke werden aus den originalen Optionen abgeleitet. `cueSequence.before`
  und `.after` transportieren sie an denselben Audio-Player und dieselbe exklusive
  Playback-Lease wie den Text. Keine zusaetzliche Audio-Autoritaet im Worker.
- App und EFB zeichnen den Original-Kettenoverlay ausschliesslich aus der
  Authority-Projektion. Kettenpunkte/Korridor ersetzen die generische Verweilzeit;
  der lokale Standalone-Detektor wird dabei weder getickt noch ueberschrieben.
- POI-Kettenpunkte und Folgeangebote sind verschiedene Dinge. Folgeangebote
  verwenden nach bestaetigtem Abschluss weiterhin `createFollowupService` und
  die im Missionspaket erhaltene `poiChain.hiddenOutcome`. Ein Folgeprofil muss
  selbst ein geoeffnetes Gate besitzen; kein automatisches Freigeben unbekannter
  Familien und keine neue KI-Missionserzeugung waehrend der Telemetrieauswertung.

Regressionen: eingefrorene Standalone-Referenzen fuer Detektor, Voice und
Soundbursts; originaler App-Seed; Cloud-Gate; Pflichtladung; Abschluss und
Folgeangebot; Wiederherstellung; Projektion ohne lokalen Tick; Missionsprozess.
Ein realer MSFS-Flug bleibt die Feldpruefung nach dem Alpha-Update.

## Geplanter Writer-Anschluss für Folgemissionen

[POI Follow-up Narrative Handoff](POI%20Follow-up%20Narrative%20Handoff.md) beschreibt
den abgestimmten Zielzustand: kompakte Writer-Erinnerung, verbindlicher Befund,
bestätigter Abschluss und unveränderte Follow-up-Freigaberegeln. Die neue
POI-Writer-Integration erfolgt separat; v438 setzt dieses Zielbild noch nicht um.

## Feuerwache / fire_watch (v440)

`mission-fire-watch-core.js` wird aus den Originalfunktionen in
`passenger-voice.js` erzeugt. Uhr, GPS, Flugzustand und Szenario sind injiziert;
keine Simulator-, Voice- oder Datei-I/O im Fachkern. `fireScenario` ist ein
Pflichtvertrag des privaten POI-Rezepts. Normale POI-Cargo-/Höhen-/Dwell-Regeln
ersetzen die spezialisierte Suche nicht: im Original wird vorher zurückgekehrt.

Die manuellen PAX-Meldungen müssen als fachliche Intents mit demselben
Revisionsschutz wie Cargo verarbeitet werden. Vor dem Intent wird ein offener
POI-Checkpoint geflusht; der neue Zustand und seine Voice-Effekte werden gemeinsam
übernommen. Statusprojektionen dürfen vorbereitete Wahrheit nicht verraten.
Zeitanzeigen dürfen keine härteren Arbeitsbedingungen als der Originalkern
behaupten. Bei bekannten Pausen/Disconnect werden gespeicherte Zeitanker
verschoben, damit eine Wiederaufnahme keine Offline-Arbeitszeit gutschreibt.

Originalfehler nicht durch eine neue Interpretation verdecken: Bei der manuellen
Fehlalarm-Meldung nach erfüllter Suchzeit fehlten Abschlussflags. Beide Pfade
wurden gezielt korrigiert; die eingefrorene Referenz und ein expliziter
Differenztest halten fest, warum genau diese Abweichung beabsichtigt ist.

### Tracker-Adapter der Feuerwache

Die Tracker-Anpassung liegt in `tracker-mission-fire-task.js`: Szenariopruefung,
Originalkern-Aufruf, Pausenzeitanker, manuelle Aktionen und oeffentliche
Fortschrittsprojektion. `tracker-mission-fire-voice.js` uebersetzt die unveraenderten
Originaltexte in bestehende Voice-Effekte. Beide Module fuehren keine I/O aus.

`tracker-mission-poi-runtime.js` behaelt die gemeinsame Checkpoint-Validierung,
Kopie des eingehenden Zustands, Sequenz-/Revisionsverwaltung und Commit-Grenzen.
Der Fire-Adapter arbeitet ausschliesslich auf diesem eigenen Checkpoint.
Persistenzformat, Gate, Effect-IDs und Wiederaufnahme bleiben kompatibel.
`passenger-voice.js` und der generierte `mission-fire-watch-core.js` werden fuer
diese Strukturverbesserung nicht geaendert. Generator-Driftpruefung und
eingefrorene Originalvergleiche bleiben verpflichtend.

## POI-Training (v442)

[Tracker Training Migration](Tracker%20Training%20Migration.md) haelt die
Originaltrigger, Modulgrenzen, Gate-Vertraege und Transportregeln fest.
Besonders wichtig: Pflichtabschluss und freiwillige Zusatzuebungen sind zwei
verschiedene Zustaende; der allgemeine POI-Terminalguard darf die Prozedur nicht
vorzeitig stilllegen. Vollstaendige POI-Trainingsrezepte sind freigegeben; APT-Training
bleibt durch diesen Anschluss unveraendert.
