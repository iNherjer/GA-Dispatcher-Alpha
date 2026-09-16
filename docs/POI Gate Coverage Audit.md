# POI-Gate: Abdeckung und offene Migrationen

Stand: 2026-09-16, aktualisiert fuer Tracker v418.

## Transport ist nicht Ausfuehrbarkeit

Cloud-Sync V2 bewahrt den gelieferten Missionszustand verlustfrei. Er erzeugt
keinen fehlenden Execution-Seed. Der App-Builder in passenger-voice.js prueft
bereits die Voice-Domaene; sync.js akzeptiert fuer den POI-Seed keine
Spezialcontroller. Der Tracker prueft nochmals Recipe, Voice und Effect-Plan.
Ein sichtbarer App-Startbanner beweist daher keine Tracker-Ausfuehrbarkeit.

## Inventar der POI-Profile

Aus `MISSION_ROLE_TASK_PROFILES` in app.js, verglichen mit dem Voice-Generator,
`tracker-mission-poi-runtime.js`, `mission-resume-adapters-core.js` und den
Originalcontrollern in passenger-voice.js:

| Profil / Domaene | Stand und notwendiger Anschluss |
| --- | --- |
| inspection_infra, media_photo, news_coverage, science_bio, science_geo | Domaene freigegeben; vollstaendiger Seed, Szenen-, Lifecycle- und Voice-Vertrag weiterhin erforderlich. |
| science_general | Zusaetzlich im Runtime-Gate unterstuetzt; kein eigener Eintrag dieser Profilliste. |
| sightseeing_tour | Ab v418 freigegeben mit akzeptiertem Wissenskontext und vollstaendigem POI-Seed. Originale Faktenauswahl und Wiederholungserinnerung extrahiert; Lifecycle, Restart und Browser-Replay geprueft. Kein manuelles Weitererzaehlen: das gehoert im Original zum Lern-Guide. |
| historian_guided_tour | Nicht freigegeben. Originale Historiker-Prompts, Kontext, Lifecycle und Wiederaufnahme gegen Standalone pruefen, bevor die Domaene aufgenommen wird. |
| tour_guide_knowledge / poi_learning_guide | Nicht freigegeben. Zusaetzlich Faktenqueue und manuelles Weitererzaehlen samt geraeteuebergreifender Faktenerinnerung anschliessen. |
| infra_chain_recon | Eigener poi_chain-Adapter. Stationen, Reihenfolge, Teilfortschritt, Voice und Wiederaufnahme aus Originalcontroller migrieren. |
| mapping_survey | Eigener survey_pattern-Adapter. Fluglinien-/Abdeckungsbewertung und deren Zustand erhalten; Verweildauer allein reicht nicht. |
| search_and_rescue | Nicht freigegeben. Originale Such-/Ergebniszustandslogik und Pax-Aktionen pruefen und uebernehmen; SAR-Ergebnishinweis im generierten Wrapper ist derzeit leer. |
| sar_heli / search_and_rescue | Eigener sar_heli-Adapter mit separatem POI-Tick; Such-, Rettungs-/Bodenablauf und Szeneneffekte migrieren. |
| fire_watch | Original ruft _tickFireMissionSearch vor dem allgemeinen POI-Tick auf. Suchzustand und Meldungen muessen mitgenommen werden. |
| freeflight_planning | Planungsprofil: zuerst bestimmen, ob ueberhaupt eine ausfuehrbare Pax-Mission entsteht; nicht automatisch zum allgemeinen POI-Auftrag umdeuten. |
| auto | Auswahlprofil; Freigabe anhand des aufgeloesten Auftrags, nicht anhand von auto. |

Zusaetzliche Marker fuer Training/Bush bleiben eigenstaendige Vertraege, auch
wenn ein Auftrag geographisch ein POI-Ziel hat.

## Freigabekriterium fuer jede Familie

1. Originale fachliche Entscheidungen extrahieren, keine parallele Nachbildung.
2. Vollstaendige Kontextdaten im Seed, State im Tracker-Journal/Checkpoint.
3. Trigger, Phasen, Cargo, Szenen, Voice und manuelle Pax-Aktionen anschliessen.
4. Vergleichstests gegen eingefrorenen Standalone-Code, dazu Restart, zweites
   Geraet, doppelte Events, Abbruch und Abschluss.
5. Erst danach App-Builder, Recipe-Gate und UI-Verfuegbarkeit gemeinsam erweitern.

Eine reine Erweiterung der Domaenenliste erfuellt diesen Vertrag nicht. Diese
Analyse aendert weder das Gate noch den freigegebenen Tracker-Release.
