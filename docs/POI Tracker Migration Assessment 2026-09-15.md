# POI-Migration zur Tracker-Ausführung: Bestandsaufnahme

Stand: 15.09.2026. Analyse des aktuellen lokalen Worktrees, keine Implementierung oder Rezeptfreigabe.

## Ergebnis

Die APT-Migration liefert die wiederverwendbare Infrastruktur: eine persistierte Ausführungsautorität, revisionsgebundene Intents, Simulator-Effekte mit ACK, Payload-/Manifestverwaltung, zentral koordinierte Voice-Ausgabe und mehrere gleichberechtigte Bediengeräte. POI benötigt auf dieser Grundlage einen eigenen vollständigen Ausführungsschnitt.

POI-Zustände lassen sich bereits übertragen und wiederherstellen. Ihre selbstständige Auswertung im Tracker ist noch nicht implementiert. Insbesondere ist `mission.snapshot.v2` keine Freigabe zur Ausführung; auch die im Execution-Core vorhandenen Ereignisse `TARGET_ENTERED` und `TASK_PROGRESS` sind noch kein POI-Detektor.

Empfehlung: zuerst ein ausdrücklich abgegrenztes Standard-POI-Rezept einschließlich Start, Luft-Task, Bodenabschluss, Voice, Szenen und Wiederaufnahme migrieren. Anschließend weitere POI-Unterrezepte einzeln freigeben. Die bestehende APT-Freigabe bleibt dabei eigenständig.

## 1. Quellenstand und Belastbarkeit

- Gelesene Grundlagen: `Mission Runtime Authority Contract.md`, `Mission Flow Reference.md`, `Mission Building Instructions.md`, `Mission Semantics Rules V4.md`, `Mission Roadmap.md`, `EFB-Development-Plan.md`, `EFB-Tracker-Architecture.md` und `Tracker Standalone Parity Audit 2026-09-08.md`.
- Zusätzlich: Szenenstrategie, Voice-Dokumentation und Worker-README für die jeweiligen Abhängigkeiten.
- Lokaler Tracker-Code und lokales Alpha-Manifest nennen v404. Das ist keine erneute Prüfung des veröffentlichten Downloads oder einer installierten EXE.
- Mehrere untersuchte Dateien enthalten bereits fremde/laufende Worktree-Änderungen. Diese Analyse betrachtet ihren aktuellen Inhalt und verändert sie nicht.
- Die Dokumentation ist umfangreich, aber chronologisch geschichtet: Der Kopf des EFB-Entwicklungsplans nennt noch v382, während spätere Einträge weitere Releases beschreiben. Auch offene Feldtestlisten im Core sind keine aktuelle Zusammenfassung aller inzwischen durchgeführten Tests.
- Die vom Nutzer berichteten erfolgreichen APT-Tests sind eine gute Ausgangsbasis. Diese Analyse führt keinen neuen MSFS- oder Mehrgeräte-Feldtest durch.

## 2. Was das heutige Gate tatsächlich tut

| Ebene | Aktueller Mechanismus | POI-Relevanz |
| --- | --- | --- |
| Desktop | `desktop/lib/tracker-process.js:executableSpec`: Alpha und `getAptMissionExecutionEnabled()` setzen `VFR_MULTITOOL_APT_EXECUTION=1`; sonst ausdrücklich `0` | Der Schalter ist derzeit APT-spezifisch |
| Trackerprozess | `tracker.js`: Alpha + Umgebungsvariable + `missionExecutionCore.TRACKER_AUTHORITY_READY === true` | Erst gemeinsam wird Execution aktiviert |
| Capability | `mission.intent.v1`, ergänzt um Cargo-/Voice-Capabilities | Die allgemeine Intent-Capability enthält noch keine Liste unterstützter POI-Rezepte |
| App-Cloud-Seed | `sync.js:_syncTrackerMissionSeedPayload` | Nur akzeptierte, geplante APT-Missionen erhalten einen Tracker-Seed; Drafts/Freiflug nicht |
| Tracker-Cloud-Seed | `tracker-mission-cloud.js:buildCloudMissionCandidate` | `adapter !== 'apt'` wird abgewiesen; APT-Effektplanschema erforderlich |
| App-Handoff | `sync.js:_pushMissionAuthoritySnapshotForExecutionHandoff` | Bundle muss `adapter === 'apt'` haben |
| Authority | `mission-authority-core.js`, `EXECUTION_HANDOFF_RECIPE = 'apt'` | Prepare, Commit und Execution-Events sind auf APT begrenzt |
| Execution-Adapter | `tracker-mission-execution-adapter.js:validateSnapshot` | Andere Rezepte werden abgewiesen |
| Effekte | `tracker-mission-simulator-effects.js:effectPlanFromRun` | Erwartet `ga.mission-apt-effect-plan.v1` und `recipe: 'apt'` |
| Folgepfade | Unter anderem Auto-Close und Payload-Refresh | Enthalten weitere ausdrückliche APT-Bedingungen |

Der Handoff prüft zusätzlich Owner, Mission/Run, Revision, Snapshot-Hash und Execution-Hash sowie Replay-/Legacy-Drift. Er ist nur in `planned`, bei Execution-Revision 0 und ohne bereits erzeugte Effekte erlaubt. Erst der bestätigte Commit wechselt die Autorität. Ein bereits laufender Web-POI wird damit heute nicht mitten im Flug zur Tracker-Mission.

Beim Start ohne offene App kommt die vorbereitete Mission aus `activeMission` plus `activeMissionTrackerSeed`. Der Tracker bietet daraus einen Cloud-Kandidaten an; die Aktivierung ist eine Benutzeraktion. Ein bereits aktiver Tracker-Run wird aus seinem lokalen Authority-/Resume-Zustand wiederhergestellt. Cloud-Seed und laufender Missionszustand haben unterschiedliche Aufgaben.

### Konkreter Befund: Rezeptwahl im App-Startgate

`_missionStartUsesTrackerExecution()` entscheidet anhand von `mission.intent.v1` beziehungsweise einer bereits gemerkten Execution-Anforderung, ohne das konkrete Rezept zu prüfen. Der geplante Startbanner ruft anschließend `prepare_mission` auf. Erst der Handoff weist POI ab; der Banner kehrt mit einem erfolglosen Ergebnis zurück.

Eine isolierte Ausführung der Originalfunktion mit POI-Missionsidentität und aktiver Capability bestätigt die Tracker-Auswahl. Das belegt einen möglichen blockierten POI-Start bei eingeschaltetem APT-Opt-in im untersuchten Bannerpfad; es ist kein Test aller Startoberflächen.

Vermutete Ursache: globale Transport-/Execution-Fähigkeit und Freigabe des konkreten Rezepts werden bei der Vorabwahl gleichgesetzt. Betroffen sein können auch andere nicht freigegebene Missionen, die diesen Startpfad verwenden. Vorschlag: vor dem ersten Handoff anhand einer gemeinsamen Rezeptfreigabe entscheiden; nach einem bestätigten Tracker-Commit weiterhin niemals lokal zurückfallen. Diese übergreifende Änderung wurde nicht umgesetzt und benötigt gemäß AGENTS.md vor Umsetzung eine gesonderte Freigabe.

## 3. APT und POI im Vergleich

| Bereich | Migrierter Standard-APT-Pfad | Heutige POI-Ausführung |
| --- | --- | --- |
| Start | Prepare, Manifest, Signatur, Boarding, Payload, Voice | Fachlich dieselben Grundbausteine |
| Ziel | Flugplatz-/Arrival-Anker | Arbeitsziel oder Gebiet, getrennt vom Abschlussort |
| Fortschritt | Airborne, Anflug, Touchdown, Ground-Still | Zusätzlich Radius, MSL-Höhe, Dwell, Versuche oder Pattern-/Suchfortschritt |
| Erfolg | Ankunft und vereinbarte Übergaben | Qualifizierter Luft-Task bzw. Unterrezept; Beenden und Erfolg unterscheiden |
| Abschluss | Ziel-Entladung, Ankunftssignatur, Farewell/Deboarding, Close | Bodenabschluss mit Task-Ergebnis, tatsächlichem Abschlussort und gegebenenfalls Heimkehrpflicht |
| Szenen | Vorbereitete Start-/Boarding-/Arrival-/Deboarding-Effekte | Zusätzlich Arbeitsziel, Rauch/Feuer, Suchlage; teilweise dynamische Terrain-/Zielauflösung |
| Voice | Gemeinsame APT-Kontexte und Tracker-Effekte | Ziel in Sicht, Eintritt, Höhenhinweise, Aufgabe erfüllt/abgebrochen, Findings, Wissen, Unterrezept-Dialoge |
| Zustand | Zentraler Run plus privater Runtime-/Effektkontext | Browservariablen, Runtime-/Missiondaten und spezialisierte Module |

### Standard-POI ist mehr als ein einfacher Timer

Der aktive Einstieg ist `sync.js:_runLiveMissionTriggerTick` → `passenger-voice.js:checkPaxPoiProximity` → `_tickPoiDwell`. Im Tracker-Modus steigt der App-Tick bereits vollständig aus. Es gibt dort bisher keinen entsprechenden Tracker-Ersatz.

Die aktuelle Dwell-Logik enthält unter anderem:

- Radius aus dem Passenger-Kontext, mit 1,5 NM als Fallback.
- Bewertung gegen `mslFt`; Toleranz im strengen Modus 200 ft, sonst je nach TaskDomain 300 oder 600 ft.
- Soll-Dwell im einfachen Modus halbiert, im strengen Modus unverändert.
- Fortschritt je Sample maximal über fünf Sekunden; zusätzlicher Entfernungsfaktor von 1 am Rand bis 2 am Zentrum.
- Unterbrechung der Zeitmessung außerhalb des Radius, ohne den bereits angesammelten Dwell pauschal zu löschen.
- Kulanzzeit, Beschwerdeabstände und begrenzte Höhenversuche bis zum Task-Abbruch.
- Abbruch bei fehlenden oder beschädigten erforderlichen Arbeitsgegenständen.
- Flyover-Erfüllung beim Eintritt für Dwell 0, mit gesonderter Behandlung von Mapping/Survey.

Diese Regeln und die konkrete Aufrufreihenfolge müssen charakterisiert werden. Ein neuer Tracker-Timer mit nur Radius und Minuten wäre nicht verhaltensgleich. Insbesondere prüft der heutige Flyover-Zweig vor der späteren Höhenbewertung; die Funktion besitzt dort keine eigene Airborne-Prüfung. Eine strengere Regel wäre eine bewusste Verhaltensänderung, keine reine Migration.

### POI ist eine Familie mehrerer Auswertungen

| Teilbereich | Vorhandener Code | Zusätzliche Migrationsarbeit |
| --- | --- | --- |
| Standard-Dwell/Flyover | `passenger-voice.js` | Fachzustand und Entscheidungen von Voice/Browserzugriff trennen |
| Survey | `mission-survey-pattern.js` | Linien-/Orbit-Abdeckung, Höhe/Kurs/Tempo, Events und Fortschritt zentral anbinden |
| POI-Kette | `mission-poi-chain-runtime.js` | Punktreihenfolge, Korridorsegmente, Findings, Completion und Kartenfortschritt |
| Training | `mission-training-procedure.js` plus Passenger-Voice | Start-/Pause-/Abbruchaktionen, Übungen, Bewertung und Instructor-Voice |
| Fire Watch | Fire-Funktionen in `passenger-voice.js` und `sync.js` | Rauchmeldung, Lagebild-Dwell, Fehlalarm, Beobachtungen und Raucheffekte |
| SAR | Fundmeldung in `passenger-voice.js`; SAR-Heli in `sync.js` | Reichweitenprüfung, Such-/Fundstatus; beim Heli zusätzlich Bergung, Patient und Krankenhausziel |
| Bush Recon Return | `mission-runtime-core.js` und POI-Task | POI-Arbeit plus bindender Heimkehrvertrag; nicht als normaler Pickup behandeln |

Survey, Kette und Training besitzen bereits CommonJS-Exports und testbare Zustandsfunktionen. Sie müssen nicht neu erfunden werden. Ihre öffentlichen Browseradapter enthalten aber auch modulweiten Zustand und teilweise Kartenanbindung; der Tracker braucht klaren, pro Run gespeicherten Zustand und definierte Ereignisausgabe.

Der Resume-Adapter (`mission-resume-adapters-core.js`) unterscheidet `poi`, `survey_pattern`, `poi_chain`, `training`, `bush_pickup` und `sar_heli`. Das sind Transportadapter, nicht deckungsgleich mit fachlichen Rezepten wie `poi_on_task_return`. Beispielsweise kann Bush-Recon wegen seiner Bush-Daten unter `bush_pickup` transportiert werden. Die Freigabe sollte deshalb einen überprüften Ausführungsvertrag verwenden und die bestehende Klassifikation nicht nebenbei ändern.

## 4. Abschluss und Erfolg getrennt erfassen

Der Execution-Core kennt zwar POI-Fortschrittsfelder, aber `TASK_PROGRESS` führt noch keinen vollständigen rezeptabhängigen Return-/Abschlussübergang aus. `GROUND_STILL` schaltet bei `atDestination` und Airborne-Nachweis auf die APT-Endphasen, ohne einen POI-Taskvertrag auszuwerten. Manifestzusammenfassung und Deboarding verwenden ebenfalls APT-orientierte Destination-Regeln.

Gleichzeitig darf bei der Migration die bestehende Web-Logik nicht durch eine vermeintlich sauberere Regel ersetzt werden: `_missionPoiGroundEndReady` erlaubt bei gewöhnlichen POIs Bodenabschluss nach ausreichendem Flugnachweis. Die Funktion fordert weder Task-Erfolg noch Heimatnähe. Eine isolierte Ausführung bestätigt `true` für Ground-Still und Flugnachweis außerhalb des Ziels. Andere Funktionen bewerten danach Erfolg/Abbruch, Heimkehr und `poiNeedsRideHome`.

Folgerung: Abschlussmöglichkeit, Task-Erfolg, fehlgeschlagener/abgebrochener Auftrag, Heimkehrpflicht und Cargo-Übergabe müssen separat im Vertrag stehen. Die vereinfachten Ablaufdiagramme reichen dafür nicht. Normale Außenlandung, vorzeitiges Beenden und verpflichtendes Return-Rezept sind eigene Referenzfälle. Ob dabei heute ein fachlicher Fehler besteht, erfordert eine gezielte Gesamtpfadprüfung; aus der einzelnen Funktion folgt noch kein unberechtigt erfolgreicher Missionsabschluss.

## 5. Was für eigenständigen Betrieb und mehrere Geräte fehlt

### A. Vollständiger, vorbereiteter POI-Seed

Zusätzlich zum bestehenden Mission-/Manifestpaket werden ein validiertes Ausführungsrezept, Taskparameter, getrennte Arbeits-/Home-/Finish-Anker, erforderliche Arbeitsgegenstände, Unterrezept-Geometrie und benötigte Voice-Kontexte gebraucht. Schwierigkeit und andere auswertungsrelevante Einstellungen müssen für alle Controller eindeutig vom Tracker kommen.

Zielszenen müssen aus denselben bestehenden Buildern vorbereitet oder über transportneutrale gemeinsame Builder aufgelöst werden. `sceneKind=none` ist ein gültiger Zustand und darf kein fehlgeschlagener Prepare-Effekt werden. Der Tracker darf nach Schließen der App weder auf deren Terrain-Callback noch auf einen neuen Prompt-/Szenenbau warten müssen. Provider-Zugang und PC-Audioausgabe sind bereits vorhandene Tracker-Bausteine.

Die Größenbudgets bleiben relevant: Cloud-Profil derzeit 256 KiB, Resume-Bundle 384 KiB. Kettengeometrie, Pattern, Szenen und Voice-Kontexte dürfen nicht unbegrenzt mehrfach abgelegt oder bei Kompaktierung still um ausführungskritische Felder gekürzt werden.

### B. Persistierter POI-Zustand und Telemetrieauswertung

Der Tracker braucht neben Dwell/Ergebnis auch Eintritts-/Samplezeiten, Höhenzustand, Beschwerde-/Versuchsstand, bereits ausgelöste Ansagen, Unterrezeptfortschritt und manuelle Meldungen. Der aktuelle POI-Resume-Snapshot enthält nur einen Teil davon; Restore setzt unter anderem Zeitanker neu.

Neustart, Sim-Pause, Menü, Positionssprung und Telemetrieausfall brauchen explizite Zeitregeln. Es darf keine Arbeitszeit aus der bloßen Dauer eines ausgeschalteten Trackers entstehen. Fortschritt muss ausreichend häufig gespeichert werden, ohne jeden Telemetriesample zum teuren vollständigen Authority-Commit zu machen. Semantische Ereignisse bleiben vor erfolgreicher Bestätigung dauerhaft gespeichert.

### C. Zentrale Effekte und Aktionen

Bestehende Effect-IDs, ACK-Verarbeitung und Audio-Lease weiterverwenden. Neue POI-Voice-Ereignisse bekommen stabile Identitäten und Abbruch-/Prioritätsregeln. Bereits erzählte Fakten und Findings müssen beim Gerätewechsel erhalten bleiben. Der fachliche Task-Erfolg darf nicht davon abhängen, ob ein Browser Audio abspielt.

POI-Bedienaktionen werden fachliche Intents: beispielsweise Fund-/Rauchmeldung oder Training starten. Der Client meldet eine Absicht; Entfernung, Rezept, Phase und Ergebnis prüft der Tracker. Aktuelle lokale Buttonhandler, die `_poiSatisfied` oder Unterrezeptzustände direkt ändern, müssen im Tracker-Modus vollständig auf diese Intents umgestellt werden.

### D. Kanonische Projektion für App und EFB

Die heutige Tracker-Missionsansicht verwendet bei Tracker-Authority `mission-apt-ui-core.js`. Für POI fehlen die vollständige kanonische Task-/Return-Darstellung, aktive Arbeitsparameter, Pattern-/Kettenfortschritt und die passenden Aktionen/Blocker. Die vorhandene Web-Phasenansicht in `mission-runtime-core.js` ist hierfür eine Referenz.

Alle Ansichten erhalten dasselbe bestätigte Ergebnis und dieselben erlaubten Aktionen. Revisionskonflikte aktualisieren den Snapshot; sie sind kein Owner-Wechsel. Navigationsänderungen dürfen Arbeitsziel, Task-Geometrie und Fortschritt nicht versehentlich umdefinieren.

### E. Transport weiterverwenden

EFB über Loopback und entfernte App über das bestehende Relay können denselben Controller behalten. Die Cloud ist Quelle des geplanten Seeds, kein zweiter Schreiber des aktiven Taskfortschritts. Ein später gestartetes Gerät verbindet sich mit dem aktuellen Tracker-Run. Nach Tracker-Commit kein stiller Rückfall zur App.

Nach bisheriger Analyse ist kein neuer Cloud-Synchronisierungsdienst erforderlich. Das betrifft mehrere Bediengeräte an einem Tracker. Eine Übernahme der Ausführung durch einen anderen Sim-PC wäre ein zusätzlicher Failover-Vertrag.

## 6. Empfohlene Umsetzungspakete

1. **Referenz und Rezeptgrenze festlegen.** Standard-Dwell/Flyover samt zulässigem Bodenabschluss, Abbruch, Return-Verhalten, Szenen und Dialogen inventarisieren. Dokumentierten Sollablauf gegen Originalfunktionen prüfen. Übergreifende Fehler separat entscheiden.
2. **POI-Fachkern extrahieren.** Zustandsübergänge aus Passenger-Voice lösen und in der Web-App verhaltensgleich anbinden; Original-/Core-Differentialtests für identische Ereignisspuren. Bestehende Manifest-/Start-/Recorder-Kerne weiterverwenden.
3. **Tracker-Schnitt vollständig bauen.** Seed, validiertes Rezept, private Runtime-Persistenz, Telemetrie, Voice/Szenen, Abschluss und Intents verbinden. Tests bei geschlossenem Browser und Tracker-Neustart.
4. **App/EFB-Projektion vervollständigen.** Gleiche Taskanzeige, Dialoge und Blocker; keine lokal mutierenden POI-Aktionen im Tracker-Modus.
5. **Rezeptbezogen freigeben.** Unterstützte Rezepte/Versionen zusätzlich zur allgemeinen Intent-Capability bekanntgeben und an allen Eintrittsstellen gleich prüfen. Vorschlag: eine separate POI-Alpha-Freigabe, damit das bestehende APT-Opt-in nicht automatisch ungeprüfte POIs aktiviert. Konkrete Schalter-/Capability-Namen sind noch nicht entschieden.
6. **Feldnachweis und Ausbau.** Ersten POI vollständig in MSFS mit geschlossener App und parallelen Controllern testen. Danach Kette/Survey, Fire Watch/SAR, Training und SAR-Heli/Bush-Return jeweils mit eigenem Vertrag und Tests nachziehen.

Der erste freigegebene Schnitt muss einen vollständigen POI-Lauf abdecken. Ein einzelner funktionierender Dwell-Zähler bei weiterhin appgeführter Voice oder appabhängigem Close erfüllt das Ziel nicht.

## 7. Nachweise dieser Analyse und noch nötige Tests

Am aktuellen Worktree bestanden:

- Fünf Node-Testsuiten: Execution-Core, Authority-Handoff, Cloud-Mission, Execution-Adapter und Execution-Runtime (87 Tests).
- Sieben Selbsttests: Resume-Adapter, POI-Kette, Survey, Training, Authority-Handoff, Ground Flow und Phase View.
- Zwei isolierte Proben mit den tatsächlichen Originalfunktionen: allgemeines App-Startgate und gewöhnliche POI-Ground-End-Readiness, wie oben beschrieben.

Für die Migration zusätzlich nötig:

- Radius-/Höhengrenzen, beide Schwierigkeitsgrade, Dwell-Gewichtung, Verlassen/Wiedereintritt, Flyover, fehlende/beschädigte Arbeitsgegenstände und Abbruch.
- Vollständiger Referenzlauf einschließlich Abschluss vor/nach Task, Außenlandung, Heimkehr, Signatur, PAX, Farewell, Debrief und Cleanup.
- Erststart aus Cloud ohne App; App nach Start schließen; Reconnect und Neustart während Task, Szene, Voice und Entladung.
- Gleichzeitige, doppelte und veraltete Intents von zwei Apps und EFB; keine doppelte Task-Erfüllung, Szene oder Ansage.
- Unvollständiger Seed, alte Tracker-/Clientversion, Stable und Alpha ohne POI-Freigabe; unveränderte APT-Regression.
- Reale MSFS-Bewegung, Szenen und Audio. Die hier bestandenen Tests sind kein POI-Tracker-Paritätsnachweis.
