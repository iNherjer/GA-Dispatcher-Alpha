# Tracker Training Migration

## Stand und Umfang

POI-Training ist ab Alpha v442 fuer `training`, `club_training_basic` und
`club_training_advanced` freigegeben, wenn ein vollstaendiges Trainingsrezept und
Flugkontext vorliegen. APT-Clubtraining war bis v444 ein eigener offener Anschluss und wurde durch
dieses POI-Gate nicht veraendert. Bekannte Eigenheiten der Standalone-Uebungen
bleiben bewusst erhalten; die Portierung korrigiert Transport und Autoritaet.

## Referenz und Modulgrenzen

- `mission-training-procedure.js`: unveraenderte Standalone-Referenz fuer
  Normalisierung, vier Uebungstypen, manuelle Starts, Wiederholungen und Extras.
- `mission-training-core.js`: generierte isolierte Instanz derselben Originalfunktionen
  mit injizierter Uhr und vollstaendigem privaten Zustand. Keine zweite Umsetzung
  von Toleranzen oder Maneuvern. Generator muss mit `--check` driftfrei sein.
- `tracker-mission-training-task.js`: JSON-Checkpoint und explizite Messdaten;
  ausschliesslich Missionsworker, keine Simulator-/Datei-/Netzwerk-I/O.
- `mission-training-voice-core.js`: aus `passenger-voice.js` extrahierte Auswahl,
  Prioritaeten, Originaltexte und Rueckmeldungen der drei manuellen Aktionen.
- `tracker-mission-training-voice.js`: erzeugt Effektbeschreibungen. Playback bleibt
  in der gemeinsamen Audio-Bridge im Parent. Kein Browser ist erforderlich.

Der oeffentliche Trainings-Snapshot ist kein vollstaendiger Worker-Checkpoint:
`lastSample` und interne aktive Phasen muessen erhalten bleiben. Insbesondere
nicht bei jedem Tick den oeffentlichen Snapshot mit `hydrateState` zuruecklesen.
Instanzen verschiedener Missionen duerfen keine Modul-Singletons teilen.

## Verbindliche Originalablaeufe

1. POI-Prebrief einmal bei <=4 NM, nur annaehernd (Toleranz 0.02 NM), sofern die
   Prozedur noch nicht gestartet/bereit/aktiv ist. Originalprompt, 300 ms Verzoegerung.
2. Gebietsmarkierung bei `max(1.2, targetRadiusNm)`; kein automatischer Uebungsstart
   und kein generischer POI-Objekt-/Verweilzeit-Trigger.
3. Startfreigabe nach originalem Abflugabstand und Hoehengate, dann drei Sekunden
   stabile Ausgangslage. Erst Pilot-Intent startet den Durchlauf; Referenzkurs und
   -hoehe werden im Tracker bereits bei der Einweisung fixiert (siehe Coaching unten).
4. Manuelle Aktionen: Start, aktuellen Durchlauf abbrechen, freiwillige Zusatzuebung.
   Originale Ablehnungsgruende/Ansagen und erneute Stabilisierung beibehalten.
5. Pflichtabschluss gibt die Rueckkehr frei. **Er stoppt nicht die Prozedur:**
   Zusatzuebungen bleiben verfuegbar. Der allgemeine POI-Terminalguard muss fuer
   diesen expliziten Trainingsvertrag gezielt erweitert werden; andere Familien
   behalten ihr Verhalten. `requiredComplete` bleibt auch waehrend Extras wahr.
6. Nach Gebietseintritt Landevorbereitung am Heimatplatz bei <=5 NM fuer Pattern,
   sonst <=4 NM. Generische APT-Anflugansage unterdruecken wie im Original.
7. Originale Trainingsauswertung und Prozedurzusammenfassung ins Debriefing geben.

## Tracker-Anschluesse

- Der verlustfreie Seed enthaelt normalisiertes Rezept, Plan, Route, Abflugpunkt,
  Sprecher und Originalkontext. Unvollstaendige Rezepte werden abgewiesen; eine
  andere JSON-Keyreihenfolge aendert ihre Identitaet nicht.
- `tracker-mission-training-runtime.js` verbindet Originalprozedur, Flugtrigger
  und Voice. `mission-training-flight-core.js` extrahiert Prebrief, Gebietseintritt,
  Landevorbereitung und Trainingsauswertung aus dem Original.
- Intents `training_ready`, `training_abort`, `training_extra` flushen den offenen
  Checkpoint und committen Zustand und Ansage atomar unter Revisionsschutz.
  App und EFB zeigen ausschliesslich den bestaetigten Trainingsfortschritt.
- Pause, Boden und mehr als fuenf Sekunden zwischen Messwerten setzen nur
  den laufenden Durchgang und die Startstabilisierung zurueck. Bestaetigte Uebungen
  und Pflichtabschluss bleiben erhalten. Keine interpolierten Stall-/Kurvenwerte.
- Der Parent uebertraegt Pitch, IAS, AOA und Stall zusaetzlich zu MSL/AGL,
  Kurs, Bank, VS und G; Slew wird als optionaler SimVar gelesen. MSL wird fuer die
  Originalauswertung explizit auf deren `mslFt`-Feld abgebildet.
- Missionslogik bleibt im Kindprozess; SimConnect, Audio und Netzwerk bleiben
  im Parent. Unveraenderte Aktionsantworten koennen Originalclips verwenden. Die
  dynamische Trainingsfuehrung verwendet die tatsaechlichen Sollwerte als Text/TTS
  statt statischer Clips mit fest eingebauten Zeiten oder Hoehenschritten.
- Verladen, Boarding, Rueckkehr, Aussteigen und Abschluss verwenden den gemeinsamen
  Authority-Ablauf. Debrief erhaelt originale Flugauswertung und Uebungszusammenfassung.
  Ein Training erzeugt durch diese Portierung keinen neuen Folgemissionstyp.

## Pruefstrategie

Originaldetektor und extrahierter Kern mit identischen Samples und Klicks
vergleichen, einschliesslich JSON-Roundtrip mitten in einer Kurve, optionalen
Uebungen und getrennten Missionen. Eingefrorene Voice-Referenz prueft alle
Ereignisse sowie jedes Ereignispaar (Prioritaet), manuelle Erfolg-/Fehlerantworten,
Sprecher, Text und statische Clip-ID. Zusaetzlich gemeinsame Authority und echter
Kindprozess: Pause, stale Intent, Restart, Audio, Pflichtabschluss plus Extra,
Rueckflug, Verladen und Abschluss. Windows-/MSFS-Feldtests bleiben nach der Alpha-Freigabe erforderlich.

## Nachweise

Die Voice-Tests vergleichen 51 Ereignisse einzeln und alle 2.601 geordneten
Ereignispaare sowie 48 Erfolgs-/Fehlerantworten der manuellen Aktionen mit der
unabhaengigen eingefrorenen Referenz (2.700 Vergleiche). Der Adaptertest prueft
zusaetzlich die Effektbeschreibung ohne Playback oder Kontextmutation.
Integrierte Tests pruefen Original-App-Seed, Cloud-Gate, Verladen/Signatur,
Start/Abbruch, veraltete Revision, Pflichtabschluss plus Extra und Wiederholung
nach Messluecke sowie echten Kindprozess. Generatorchecks sichern die Extraktion.
Diese Nachweise ersetzen keinen Feldtest mit realem Flugzeug in MSFS.


## Tracker-Coaching und dauerhaftes Aufgabenbanner (v443)

Bewusste Tracker-Nachschaerfung; `mission-training-procedure.js` und die extrahierte
Originalprozedur bleiben unveraendert. `tracker-mission-training-coaching.js` liegt
vor/nach dem Originaldetektor im Missionsprozess und liefert zugleich die
verbindlichen Bannerkriterien. Kein eigener Detektor in App, EFB oder Telemetrieloop.

- Bei Einweisung Referenzhoehe auf 100 ft und Kurs auf ein Grad fixieren. Diese
  Werte bleiben beim Klick auf Start bestehen; Vorbereitung muss Hoehe/Kurs,
  Bank/VS und die Uebungs-Mindesthoehe drei Sekunden erfuellen. Abweichungen
  nehmen die Startfreigabe zurueck. Stall verwendet sein eigenes AGL-Gate.
- Nummerierte Schritte: Ausgangshoehe, Kurs, Stabilisierung, danach Manoever und
  Ausleiten bzw. Halten/Hoehenwechsel/Halten oder Stall-Phasen. Erfuellte Schritte
  gruen durchgestrichen, aktuelle Abweichungen rot blinkend (ohne Animation bei
  Reduced Motion), Winkel-/Haltefortschritt als Balken. Vor Start koennen gruen
  markierte Voraussetzungen wieder rot werden; waehrend des Manoevers zeigt
  dessen Zeile die laufende Einhaltung. Vollkreis bedeutet 360 Grad.
- Haltezeit nur bei kontinuierlich passenden Werten; Abweichung setzt Haltezeit
  zurueck. Auch Ausleiten erfordert die richtige Hoehe. Gegenlaeufige Kurvenbewegung
  nimmt Winkel zurueck. Ueberschossene Kurvenziele verlangen einen neuen Versuch.
- 15 Sekunden fortlaufende Sollwertabweichung fuehren zum Neuansetzen. Kein
  Fortschritt: Einleiten/Kurve/Ausleiten 45 s, Stall-Stabilisierung/Break/Recovery
  60 s, Hoehenwechsel/Stall-Annaeherung 120 s. Absolute Abschnittsgrenze 10 min.
  Bestehende strengere Original-Abbruchbedingungen gelten weiterhin.
- Keine harte Missionssperre nach mehreren Fehlversuchen; stattdessen Hilfetext.
  Manuelles Abbrechen und Neuansetzen bleiben moeglich, bestaetigte Uebungen
  und Pflichtabschluss bleiben erhalten. Telemetrieluecke >5 s, Pause/Slew/Boden
  unterbrechen den aktuellen Durchgang mit sichtbarem Hinweis.
- Strukturelle Ansagen (Einweisung/Phase/Ergebnis) haben Vorrang vor allgemeinem
  Wertefeedback. Texte enthalten echte Rezeptwerte, keine fest angenommenen
  60 Sekunden/500 ft/zwei Uebungen. Phasengebundene Audioeffekte werden vor
  Erzeugung und Playback gegen Index/Versuch/Phase geprueft.
- `training_repeat_instruction` und trainingsspezifischer `poi_status` lesen den
  aktuellen Plan ohne Detektormutation. Verlauf der letzten 30 Ansagen bleibt im
  privaten Checkpoint und oeffentlichen Guidance-Modell erhalten. Ohne TTS-Zugang
  bleiben Plan, Hinweise und Verlauf lesbar.
- `control.poiTask.trainingGuidance` (POI) bzw. `control.trainingTask.guidance` (APT) tragen denselben UI-Vertrag. Gemeinsamer
  `mission-training-guidance-ui.js` in App bei Tracker-Autoritaet und Tracker-EFB;
  verschiebbar, einklappbar, mit erneutem Vorlesen und lesbarem Verlauf. Nach
  Abschluss verschwindet die laufende Aufgabenanzeige.
- Lokale Worker-Projektion maximal einmal pro Sekunde statt fuenf Sekunden fuer
  Trainingsfortschritt. Der bestehende Disk-Checkpoint-Takt bleibt erhalten;
  es entstehen keine zusaetzlichen Cloud-Worker-Writes fuer Banner-Ticks.

Regressionsfaelle: gruene Voraussetzungen wieder rot, feste Referenzen, Wiederlesen
nach Restore, kontinuierliche Haltezeit, falsche Kurvenrichtung, festgefahrenes
Ausleiten, Ausleiten mit falscher Hoehe, Messluecke waehrend Zusatzuebung sowie
veraltete Audioeffekte. Original-Extraktions-/Paritaetstests bleiben verbindlich;
die Tracker-Coaching-Abweichungen werden separat getestet.

## Abdeckung aller vorhandenen Prozeduraufgaben (v444)

Das gemeinsame Guidance-/Banner-Modell gilt fuer alle vier normalisierten
Uebungstypen und deren Rezeptvarianten, auch fuer freiwillige Zusatzuebungen:

| Typ | Anpassung der Anzeige | Fortschritt |
| --- | --- | --- |
| `constant_bank_360` | Links/rechts/frei, tatsaechliche Bank (z.B. 30/45 Grad), Hoehenband, G-Grenze, Ausleitkurs/-bank | 360 Grad und stabile Ausleitzeit |
| `turn_180` | Gleiche Kriterien mit 180-Grad-Ziel und eigenen Rezeptgrenzen | 180 Grad und stabile Ausleitzeit |
| `altitude_step_hold` | Steigen/Sinken, freie Schrittweite/Haltedauer, IAS-Referenz und Toleranz, Kurs/Bank/VS | kontinuierliche Haltezeit, Hoehenwechsel, finale Haltezeit |
| `stall_recovery` | Stabilisieren, Annaeherung, Break abwarten, Recovery; Hoehen-/Kurs-/Bankgrenzen, Stallwarnung, AOA soweit vorhanden, Sinkrate | stabile Setup-/Recovery-Zeit; Break bleibt bestaetigtes Ereignis ohne erfundene Prozentzahl |

Live-Details zeigen gemessene Werte. Bei freier Kurvenrichtung wird nach Einleitung
die gewaehlte Richtung angezeigt. Die VS-Grenze beim Hoehenwechsel bildet den
Originaldetektor ab (`maxVsFpm + 250`), nicht nur den engeren nominalen Rezeptwert.

Abgrenzung: Das ist die Abdeckung der messbaren POI-Trainingsprozedur fuer
`training`, `club_training_basic`, `club_training_advanced`. Das Rezeptfeld
`mode=pattern` allein definiert keine Gegen-/Quer-/Endanflug- oder Landetrigger.
APT nutzt ab v445 denselben Trainingsablauf. Fuer neue Platzrundenabschnitte fehlen weiterhin explizite Abschnittskriterien. Der Renderer ist dafuer
wiederverwendbar; ohne solche Kriterien werden keine Erfolgshaken erfunden.
Standalone und deren Rezeptnormalisierung bleiben unveraendert.

Tests durchlaufen echte Originaldetektor-Phasen fuer 12 Kurvenvarianten,
Steigen/Sinken mit abweichenden Rezeptwerten und Stall inklusive Restore,
roter Abweichungen, stabiler Zeitmessung und Abschluss. Zusaetzlich G-Abweichung
im Banner vor Ablauf der bestehenden Detektor-Toleranzzeit.


## APT-Anschluss v445

- `executionTrainingRecipe` transportiert das vollstaendige Originalrezept mit
  eigenem APT-Voice-Kontext; Cloud und Authority lehnen Trainingsmissionen ohne
  diesen Vertrag ab. Gewoehnliche APT-Missionen behalten ihren bisherigen Pfad.
- `tracker-mission-apt-training.js` betreibt denselben Training-Runtime/Core wie
  POI ausschliesslich im Missionsprozess. `state.trainingTask` enthaelt den
  persistierten Checkpoint; Telemetrie und Audio verbleiben in ihren bisherigen
  getrennten Prozessen. Publikation maximal einmal pro Sekunde plus Ereignisse;
  keine zusaetzlichen Cloud-Writes pro Messwert.
- Starten, Abbrechen, Wiederholen der Anweisung und Zusatzuebung verwenden
  dieselben Intents und Guards. App und EFB lesen denselben Fortschritt und
  dasselbe chronologische Banner. Pausen/Datenluecken setzen nur den laufenden
  Durchgang zurueck; abgeschlossene Uebungen bleiben erhalten.
- Originale APT-Flugansagen: Aufgabenbriefing ab 50 Prozent der direkten
  Start-Ziel-Distanz, Landebriefing bei 5 NM (`pattern`) bzw. 4 NM (andere Modi).
  Generische APT-Anflugansage bleibt dabei unterdrueckt. Das Abschlussgespraech
  verwendet die originale Trainingsauswertung und Prozedurzusammenfassung.
- Ein bestandener Trainingsdurchgang beendet weder die APT-Mission noch setzt
  er POI-Zielerfolg. Zielankunft, Landung und Abschluss bleiben APT-Aufgaben.
- `pattern` erzeugt keine erfundenen Haken fuer Gegen-/Quer-/Endanflug: Nur die
  vier vorhandenen messbaren Prozedurtypen bekommen Abschnittserfolge.
- Tests: Originalvergleich der APT-Flugansagen und Farewell, verlustfreier Seed,
  Verladen/Start/Abbruch/Revisionen, Zusatzuebung/Datenluecke/JSON-Restore und
  Telemetrie plus Intents im echten Missions-Kindprozess.

## Freigabeanzeige und Trainingsabschluss (25.09.2026)

Der Feldbericht zu v450 zeigt einen Trainingslauf ohne sichtbare Freigabe sowie
Ladungskritik nach einer Ausweichlandung. Die Logs enthalten keine Rohwerte fuer
AGL/Abflugentfernung und keinen Trainingscheckpoint; sie beweisen daher nicht,
welches Freigabegate im konkreten Flug blockiert hat. Der POI-Adaptername ist auch
fuer Training korrekt und kein Nachweis einer falschen TaskDomain.

Die bestehende Normalisierung kann `readyMinAglFt=2500` erzeugen, wenn eine der
Pflichtuebungen Stall-Recovery ist. Vor der Einweisung war Guidance unsichtbar
und ihr Text nannte stattdessen die Mindesthoehe der ersten Uebung (oft 1200).
Die Freigabeanzeige zeigt jetzt vor der Einweisung die wirklichen Rezeptgrenzen,
Abflugentfernung und AGL sowie fehlende/unterbrochene Messwerte. Die vorhandenen
Hoehenregeln und drei Sekunden Stabilisierung bleiben unveraendert. Ein
Turn-only-Rezept gibt bei 5 NM/1200 ft und stabiler Ausgangslage weiterhin frei.

Offene Pflichtuebungen werden bei POI-Training separat als `taskFailureReasons`
getragen. `notDeliveredRequired` enthaelt nur reale Frachtpositionen. Training
kann nach Flugnachweis an einem anderen Platz beendet werden; Pflichtabschluss,
tatsaechliche Ladungsmaengel und Rueckflugwunsch werden getrennt bewertet und
angesprochen. Erfuellte Uebungen verdecken keine echte beschaedigte oder nicht
entladene Pflichtausruestung. Andere POI-Familien behalten ihren Outcome-Vertrag.

Die eingefrorenen Differentialtests pruefen fuer Training weiterhin unveraendert
Navigation, Ankunft und Abschlussort. Die bewusst korrigierten Trainings-Outcomes
und Abschiedstexte haben eigene Regressionstests; die historischen Fixtures
bleiben unveraendert. Ein erneuter MSFS-Flug ist fuer die konkrete Ursache und die
reale Audio-/EFB-Darstellung weiterhin erforderlich.

### Kartentisch-Banner (2026-10-01)

Das gemeinsame Trainingsbanner liegt ueber dem Vollbild-Kartentisch
(z-index 120010 gegen 120000), weiterhin unter modalen Dialogen. App und
gebuendelte EFB-Styles nutzen dieselbe Ebene. Ein UI-Regressionstest sichert
diese Reihenfolge ab. Der Integrationslauf prueft Boden-Unterbrechung und
Freigabe nach frischen, vollstaendigen Flugwerten.

Bei der Untersuchung wurde reproduziert: Fehlt der optionale GS-Wert,
verwirft die gemeinsame POI-Validierung den Flugdatensatz, bevor das Training
Position und AGL uebernehmen kann. Das kann die Meldung ueber fehlende
Position/AGL verursachen. Die Zuordnung zum gemeldeten MSFS-Flug ist ohne
Tracker-Gate-Log noch nicht bestaetigt. Nach User-Freigabe wurde die Validierung
gezielt fuer Training mit explizitem `onGround=false` korrigiert: GS ist dort
optional. Am Boden und fuer andere POI-Familien bleibt GS erforderlich.
Position und Hoehe bleiben Pflichtwerte, die Trainingspruefung verlangt
weiterhin AGL, Kurs, Bank und Vertikalgeschwindigkeit. Ungueltige bzw.
unterbrochene Datensaetze erreichen nun auch bei Training den Task-Driver,
damit die Unterbrechung wirksam wird; veraltete Samples bleiben No-ops.
Integrationstests sichern Freigabe ohne GS und Sperre bei jedem fehlenden
Sicherheitswert ab. Karte/Missionsmenue und Training beziehen ihre Werte
aus derselben SimConnect-Quelle, durchlaufen aber unterschiedliche
Validierungs- und Projektionswege. Es wird kein GS-Wert erfunden oder
durch IAS ersetzt.

### Trainingsbanner-Aktionsfreigaben, 2026-10-05 (Tracker v477 / App v1924)

Das Banner in Webapp und EFB schneidet seine Start-/Abbruch-/Wiederholen-
Angebote mit `control.allowedActions` des Trackers. Ein gespeicherter
Guidance-Status allein darf keine aktuell gesperrte Aktion anbieten. Die
Missions-State-Machine und Voice-Sperren bleiben unveraendert. Der UI-Test
prueft leere Freigaben, ausschliesslich Wiederholen und Legacy-Aufrufer.

Der Oct5-Log belegt vollstaendige Telemetrie und erfuellte Distanz-/AGL-Gates,
aber eine dauerhaft gesetzte Suspension. Die damalige Diagnostik enthaelt
nicht die einzelnen Sperrgruende. Sie protokolliert nun Beobachtungsgrund,
Pause, Menu, Boden, Slew, GS und Pause-Flags. Keine Sicherheitspruefung
wurde auf Verdacht entfernt.

Die Cockpit-Transport-Allowlist enthielt keine Trainingsaktionen und wies
sie bereits vor dem Executor mit mission_intent_not_allowed ab. Die vier
bestehenden Trainingsaktionen sind nun zugelassen; fachliche State-/Revision-
Pruefungen bleiben beim Executor. Ein Test prueft Web- und EFB-Sessions.
Alpha-Rollout v477 enthaelt diese Korrekturen; die Ursache der Suspension im realen Oct5-Lauf bleibt offen.

Empfangene Trainingswerte werden nun auch auf dem Suspend-/Invalid-Pfad
in den Guidance-Snapshot uebernommen (POI und APT). Das aendert keine
Freigabe oder Uebungsergebnisse. Ein Integrationstest prueft fortlaufende
AGL-/Distanz-Anzeige bei pausiertem Training ohne Startfreigabe.

Freigabe-Stichprobe: sechs Suspend-Ursachen (Boden, Pause, Menu, Slew,
fehlende Position, fehlendes AGL) werden nach frischer Telemetrie und
drei Sekunden stabiler Vorbereitung geloest; training_ready startet das
Manoever. Zusaetzlich geprueft: Pause im echten Mission-Child-Prozess
und Simulator-Disconnect/Reconnect waehrend einer Uebung. Alle Tests
bestanden. Der dauerhaft gesperrte reale Oct5-Lauf bleibt damit nicht
reproduziert; es fehlen seine konkreten Pause-/Slew-/Boden-Sperrwerte.

Alpha v477 oeffentlich heruntergeladen und auf 173155226 Bytes sowie
SHA-256 d8076bdcac424d17a49441805be2b6ebd6e8fe3537a46cf92510ad915f5f3150
verifiziert. Kanalaktivierung mit App-Cache v1925; Stable bleibt unveraendert.
Windows-EXE auf Apple ARM ohne Bytecode gebaut; ein echter MSFS-Feldtest
ist weiterhin ausstehend.


### Feldbericht 06.10.2026: falsches Slew-Signal (lokal, noch nicht ausgerollt)

Im realen v478-Lauf sind Position, AGL und Abflugdistanz vorhanden; beide
Freigabegates sind erfüllt. `simPaused=false`, `inMenuOrMap=false`,
`onGround=false` und `pauseFlags=0`, aber `slewActive=true`. Der Pilot bestätigt,
dass der Versetzmodus ausgeschaltet war. Die Sperre entspricht damit dem
empfangenen Status, nicht dem tatsächlich beschriebenen Simulatorzustand.

Die Trainingsanzeige benennt lokal jetzt den konkreten Sperrgrund (Pause,
Menü, vom Tracker gemeldetes Slew, Boden oder Datenunterbrechung). Ein Wechsel
des Grunds während einer bestehenden Unterbrechung aktualisiert den Hinweis;
unveränderte Gründe erzeugen keine weiteren Verlaufseinträge. Die Gates und
bereits erfüllte Übungen bleiben unverändert.

Die gemeinsame Telemetrie liest optionale SimVars positionsgebunden. Die
verwendete node-simconnect-Bibliothek liefert bei `addToDataDefinition` eine
Send-ID, keine Bestätigung der simulatorseitigen Annahme. Asynchrone
Definitionsfehler werden bislang nicht den einzelnen GPS-Feldern zugeordnet.
Eine absichtliche Fehlernachstellung mit vier ausgelassenen optionalen
Wetterfeldern verschiebt Gewichtswerte in Slew/Pause. Dabei entstehen exakt
die Pausewerte 1700/222 eines älteren Logeintrags. Das beweist den möglichen
Fehlermechanismus, nicht die tatsächliche Ablehnung dieser vier Felder im
v478-Feldflug. Rohwert und unabhängige Slew-Abfrage fehlen im Feldlog.

Vorgeschlagener nächster Schritt: `IS SLEW ACTIVE` separat lesen, Lesen über
eigene Request-/Definition-ID eindeutig zuordnen und Rohwert, Paketform sowie
Definitionsfehler protokollieren. Kein Abschalten des Slew-Schutzes, keine
Interpretation von Flugbewegung als Ersatz für den Modus. Diese gemeinsame
Quelle betrifft auch Survey/Infra, Bush/SAR und Routenansagen. Die User-Freigabe
für die separate Abfrage und SDK-/Netzrecherche liegt seit 06.10.2026 vor. Die bisherige Sammelpaket-Decodierung wird nicht ungeprüft erweitert.


#### SDK-/Bibliotheksprüfung und separate Abfrage (06.10.2026, Tracker v479)

- Das MSFS-2024-SDK definiert `IS SLEW ACTIVE` als tatsächlich aktiven Modus;
  `IS SLEW ALLOWED` ist eine andere Variable. Der bisherige Variablenname ist
  richtig. [Aircraft Miscellaneous Variables](https://docs.flightsimulator.com/msfs2024/retail/programming-apis/simvars/aircraft-simvars/aircraft-miscellaneous-variables/).
- Bool darf als Integer oder Float gelesen werden; FLOAT64 war damit allein
  kein Fehler. [SimVar Data Types](https://docs.flightsimulator.com/msfs2024/flighting/programming-apis/simvars/simulation-variables/).
- Das SDK verlangt zusätzlich die Prüfung asynchroner Server-Exceptions;
  unmittelbare API-Rückgaben bestätigen nur clientseitige Verarbeitung.
  Send-ID ordnet die Exception dem fehlerhaften Aufruf zu.
  [SIMCONNECT_RECV_EXCEPTION](https://docs.flightsimulator.com/msfs2024/retail/programming-apis/simconnect/api-reference/structures-and-enumerations/simconnect_recv_exception/).
  Die lokale node-simconnect-Implementierung bestätigt eine Send-ID als
  Rückgabe von `addToDataDefinition`, keine native HRESULT-Rückgabe.
- Die Hersteller-Recherche liefert keinen belastbaren Beleg, dass der MSFS-
  Comanche-Normalflug absichtlich `IS SLEW ACTIVE=true` melden sollte. Aus ihrem
  separaten Flight Model wird deshalb keine Sonderausnahme abgeleitet.

`tracker-slew-telemetry.js` liest nun einen einzelnen INT32-Datum für USER (0)
über Definition/Request 209. Identität, defineCount=1 und vier Datenbytes werden
vor dem Lesen geprüft. Eigene Server-Exceptions werden per Send-ID korreliert;
Close entfernt Listener und verwirft Messwerte. Gleicher Visual-Frame-Takt wie
GPS; keine zusätzlichen Timer oder Cloud-Aufrufe. Der bisherige Sammelpaket-
Slot bleibt nur für Vergleichsdiagnostik unverändert. Es gibt keinen Fallback
von der separaten Abfrage auf diesen möglicherweise verschobenen Slot.

`TRACKER_SLEW_DIAGNOSTIC` protokolliert eigenständigen Rohwert, Alter, Status,
Fehler sowie alten Paketwert und Widerspruch. Änderungen werden geloggt,
unveränderter Widerspruch maximal alle 30 Sekunden. Zusätzlich protokolliert
`TRACKER_GPS_DEFINITION_ERROR` die vom Simulator abgelehnte GPS-Definition mit
Name/Key/Send-ID/Fehler. Die übrige Sammelpaket-Decodierung bleibt außerhalb
dieser gezielten Korrektur; tatsächliche Ablehnungen können erst der nächste
MSFS-Feldlauf und sein Log identifizieren.

Neue Tracker-Samples tragen `slewTelemetryStatus`. Training (APT und POI)
wartet bei waiting/error/stale explizit auf eine gültige Statusmeldung;
unbekannt wird nicht als „aus“ interpretiert. Legacy-Samples ohne dieses Feld
behalten ihren bisherigen Vertrag. Die Kriterien für Entfernung, AGL,
Stabilisierung und die eigentliche Übung ändern sich nicht. Tests prüfen
falschen Bulk-Gewichtswert, echte Ein/Aus-Wechsel, ungültige Pakete, Exception-
Zuordnung, frische Werte nach Datenlücke und beide integrierten Trainingspfade.
Release-Ziel ist Tracker v479 im Alpha-Kanal. 152 gezielte Regressionstests
bestehen. Die eigenständige Abfrage ist noch nicht in MSFS verifiziert; der
nächste Feldlauf muss den gemeldeten Rohwert und die Trainingsfreigabe bestätigen.

Alpha-Rollout 06.10.2026: Tracker v479 veröffentlicht; der öffentliche EXE-
Download stimmt mit dem Build überein (173555256 Bytes, SHA-256
`6b3a36cea20e09bea02decf5d71ec681ebeabb59764da0794dca8919c077b108`).
Der Alpha-Kanal wird auf dieses unveränderte Artefakt gesetzt. Stable bleibt
unverändert; die Simulatorprüfung ist weiterhin offen.


### Slew ist kein Trainingsgate mehr (06.10.2026, lokal)

Auf ausdrücklichen Nutzerwunsch blockieren `slewActive`, `slewMode`,
`isSlewActive` und ein fehlender/fehlerhafter/veralteter `slewTelemetryStatus`
weder POI- noch APT-Training. Beobachtung und manuelle Intents verwenden
dieselbe Regel. Damit überschreibt diese Entscheidung die v479-Regel oben.
Pause, Menü, Boden, Datenfrische, gültige Positions-/Flugwerte, AGL-/Distanzgates,
Startstabilisierung und die eigentlichen Manöverkriterien bleiben erhalten.
Für das Training bleibt die getrennte SimConnect-Abfrage reine Diagnose. Es gibt keinen neuen
Schalter und keinen zweiten Ausführungspfad. Ein alter Slew-Sperrstand wird
mit dem nächsten gültigen Sample aufgelöst; eine laufende Übung wird dadurch
nicht rückwirkend als bestanden markiert.

Die zunächst breiter gewünschte Entfernung wurde vom automatischen
Freigabeprüfer blockiert. Der anschließend ausdrücklich auf Survey und
Infrastruktur begrenzte Auftrag wurde freigegeben und lokal umgesetzt;
siehe `Mapping Survey Migration Audit.md` und
`Infrastructure Chain Briefing Migration.md`. Der anschließende Nutzerauftrag
entfernt nun auch die Bush- und Route-Voice-Slew-Gates; siehe
`Mission Flow Reference.md` und `Mission Route Voice Events.md`. SAR bleibt
unverändert. Noch kein Rollout.

Nachweis: 219 Tests der Trainings-, Execution- und übrigen Missionsregression bestanden. Die
positiven POI-/APT-Manöverläufe verwenden zusätzlich aktive Slew-Flags und
fehlerhaften Status; Wiederaufnahme wird ebenfalls mit Slew-Flag geprüft.


Abschluss der missionsübergreifenden lokalen Prüfung (06.10.2026): Die
anschließend freigegebenen Voice-Übergabefehler für Sightseeing, Private Return
und Bush-PAX-Anflug sowie der vorhandene Reporter-Generator-Drift sind korrigiert.
874 + 223 = 1.097 Prüfungen bestanden ohne Fehler oder übersprungene Tests,
einschließlich POI-/APT-Training, Restore und Generator-Parität. Details und
Reproduktionsnachweise stehen in `Mission Flow Reference.md`. Noch kein neuer
Tracker-Build oder Rollout; die Simulatorprüfung bleibt ausstehend.


## Manueller Start bindet den Durchgang sofort (06.10.2026, lokal)

Der akzeptierte `training_ready`-Klick initialisiert jetzt den aktiven
Übungsdurchgang mit der letzten gültigen Vorbereitungstelemetrie über den
bestehenden Prozeduradapter. Kurs, Höhe und ggf. IAS sind damit vor dem ersten
neuen Messwert festgelegt. Direkte Kurveneinleitung kann den bestätigten Start
nicht mehr durch die Vorbereitungsprüfung zurücknehmen. Die Startansage benennt
die bereits festgelegten Referenzen; der Banner projiziert sofort den aktiven
Durchgang. Ein Abbruch benötigt keinen weiteren Messwert.

Vor POI- und APT-Trainingsaktionen wird die gepufferte Telemetrie in den
Checkpoint übernommen. Controller-Revision zuerst prüfen, dann ausschließlich
für den eigenen synchronen Checkpoint auf die aktuelle Revision umstellen.
Eine vor dem Klick verlorene stabile Fluglage lehnt den Start weiterhin ab;
aktuelle gültige Werte ersetzen dagegen die ältere Vorschau. Gewöhnliche
APT-Aktionen bleiben außerhalb dieses zusätzlichen Trainingsabgleichs.

Originalcore/Standalone unverändert. Keine automatische Freigabe ohne Klick;
Pause, Datenlücken, Sicherheitsgates, Abbruch und Zusatzübungen bleiben erhalten.
Zehn neue Regressionen plus direkte Einleitung in den vorhandenen echten
Missions-Kindprozess-Tests für POI und APT. **225 betroffene Tests grün**, Original-
Prozedur-Selbsttest und Syntaxprüfung grün. Noch kein Release oder MSFS-Feldtest.
