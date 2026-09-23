# Tracker Training Migration

## Stand und Umfang

POI-Training ist ab Alpha v442 fuer `training`, `club_training_basic` und
`club_training_advanced` freigegeben, wenn ein vollstaendiges Trainingsrezept und
Flugkontext vorliegen. APT-Clubtraining ist ein eigener Anschluss und wird durch
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
   -hoehe stammen vom naechsten Messwert.
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
  im Parent. Trainingsclips einschliesslich `stall_*` werden aus dem gepackten
  Originalkatalog abgespielt. Fehlende Clips verwenden den normalen TTS-Fallback.
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
