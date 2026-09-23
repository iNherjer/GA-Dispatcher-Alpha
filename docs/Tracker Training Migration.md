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
- Pause, Boden, Slew und mehr als fuenf Sekunden zwischen Messwerten setzen nur
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
