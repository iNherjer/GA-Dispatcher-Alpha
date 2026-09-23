# POI-Gate: Abdeckung und offene Migrationen

Stand: 23.09.2026, Tracker v450. Diese Tabelle ersetzt die historische v419-Inventur.

## Transport ist nicht Ausfuehrbarkeit

Cloud-Sync V2 bewahrt den gelieferten Missionszustand verlustfrei. Ein gueltiger
Execution-Seed mit Voice-, Szenen- und Lifecycle-Vertrag bleibt Voraussetzung.
App-Builder und Tracker validieren beide; ein sichtbarer App-Startbanner allein
beweist keine Tracker-Ausfuehrbarkeit. Geoeffnete Gates sind kein MSFS-Feldnachweis.

## Aktuelle Abdeckung

| Profil / Domaene | Tracker-Stand |
| --- | --- |
| inspection_infra, media_photo, news_coverage, science_bio, science_geo, science_general | Standard-POI freigegeben. |
| sightseeing_tour | Freigegeben; optionale Fakten und Wiederholungserinnerung, kein manuelles Weitererzaehlen. |
| historian_guided_tour | Ab v449 freigegeben; originale Historiker-Prompts, Wiki-/Zielfakten, kompakte narrative Memory. Keine Guide-Faktenqueue. |
| tour_guide_knowledge / poi_learning_guide | Freigegeben; originale Faktenqueue und manuelles Weitererzaehlen mit autoritativer Reservierung. |
| infra_chain_recon | Freigegeben mit validiertem poi_chain-Vertrag, Stationen, Korridor, Teilfortschritt und Voice. |
| mapping_survey | Freigegeben mit Survey-Vertrag fuer Linien/Orbit und Abdeckung. |
| search_and_rescue (Flaechenflugzeug) | Freigegeben mit SAR-Such-/Meldevertrag und Originalergebnis. |
| sar_heli | Weiterhin ausgeschlossen; eigene Rettungs-/Bodenablaeufe nicht migriert. |
| fire_watch | Freigegeben mit Original-Suchzustand, Meldungen und Szeneneffekten. |
| training, club_training_basic, club_training_advanced | Freigegeben mit eigenem Trainingsvertrag und manuellen Aktionen/Guidance. APT separat angebunden. |
| Bush: supply_strip, charter_strip, scenic_hopper | Ab v447 freigegeben mit eigenem Bush-Vertrag. |
| Bush: pickup_strip, pickup_cargo, recon_return | Ab v448 freigegeben mit Pickup-/Heimkehr-/Recon-Vertrag. Profil-IDs tragen jeweils `bush_`. |
| freeflight_planning | Ab v450 separater Cloud-/Tracker-Navigationsanschluss mit Briefing und Restore; bewusst kein Pax-/Missionsrezept. |
| auto | Auswahlprofil; Freigabe anhand des aufgeloesten Auftrags. |

Details und Testgrenzen: `Tracker Mission Migration Guide.md`.

## Freigabekriterium fuer jede Familie

1. Originale fachliche Entscheidungen extrahieren, keine parallele Nachbildung.
2. Vollstaendige Kontextdaten im Seed, State im Tracker-Journal/Checkpoint.
3. Trigger, Phasen, Cargo, Szenen, Voice und manuelle Pax-Aktionen anschliessen.
4. Vergleichstests gegen eingefrorenen Standalone-Code, dazu Restart, zweites
   Geraet, doppelte Events, Abbruch und Abschluss.
5. Erst danach App-Builder, Recipe-Gate und UI-Verfuegbarkeit gemeinsam erweitern.

Eine reine Erweiterung der Domaenenliste erfuellt diesen Vertrag nicht. Die Tabelle dokumentiert den Implementierungsstand; Releases und Feldtests bleiben separat.
