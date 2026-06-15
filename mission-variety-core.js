// Mission variety helpers and maintainable prompt candidate pools.
// Keep this file framework-free: it is loaded in the browser app and in VM dryruns.
(function missionVarietyCore(root) {
    'use strict';

    const STORAGE_PREFIX = 'ga_mission_variety_history_';
    const DEFAULT_HISTORY_LIMIT = 32;

    const BUSH_PICKUP_STRIP_CANDIDATES = [
        {
            id: 'trail_ranger_closure',
            familyId: 'ranger_trail',
            label: 'Ranger- und Trail-Arbeit',
            tags: ['forest', 'trail', 'weather', 'water', 'remote_strip'],
            weight: 1.15,
            roleIdeas: ['USFS-Rangerin', 'Trail-Crew-Leiter', 'Backcountry-Permit-Kontakt'],
            taskIdeas: ['Markierungen am Bachlauf gesetzt', 'Trail-Sperren nach Wetter kontrolliert', 'Wildwechsel und umgestuerzte Aeste dokumentiert'],
            objectIdeas: ['Kartenmappe', 'Markierungsband', 'Rucksack', 'kleine Rueckholkiste'],
            returnDrivers: ['Rangerstation braucht Sperrnotizen', 'naechste Crew braucht die Trailhinweise fuer die Planung', 'Permit-Planung wird in der Basis aktualisiert'],
            accessReasons: ['naechster brauchbarer Strip zum Talabschnitt', 'sicherer Abholpunkt vor weiterem Gelaendemarsch', 'Treffpunkt fuer ein verstreutes Feldteam']
        },
        {
            id: 'strip_ops_inspector',
            familyId: 'strip_ops',
            label: 'Strip-Betrieb und Platzcheck',
            tags: ['remote_strip', 'ranch', 'maintenance', 'road'],
            weight: 1.2,
            roleIdeas: ['Strip-Betreiber', 'USFS-Technikinspektorin', 'Backcountry-Operations-Kontakt'],
            taskIdeas: ['Windsackbefestigung und Randstreifen geprueft', 'Zufahrtsgatter und Notfallkasten dokumentiert', 'Spurrinnen und lose Gegenstaende am Bahnrand notiert'],
            objectIdeas: ['Pruefmappe', 'Werkzeugtasche', 'Tablet', 'zwei leichte Kisten'],
            returnDrivers: ['Freigabe- und Maengelnotizen gehen in die Planung', 'Versorgungsflug wartet auf den Strip-Status', 'Betreiberakte braucht Fotos und Freigabeentscheidung'],
            accessReasons: ['der Strip selbst ist der Arbeitsort', 'Parkpunkt am Pistenrand ist der sichere Treffpunkt', 'kurzer Check nach Wetter- oder Nutzungsfenster']
        },
        {
            id: 'utility_power_pump',
            familyId: 'utility_service',
            label: 'Generator, Pumpe oder Versorgungstechnik',
            tags: ['maintenance', 'power', 'water', 'ranch', 'camp'],
            weight: 1.05,
            roleIdeas: ['Utility-Technikerin', 'Pumpenmechaniker', 'Generator-Servicekontakt'],
            taskIdeas: ['Generatorlauf protokolliert', 'Pumpenleitung entlueftet', 'Batterie- und Sicherungskasten kontrolliert'],
            objectIdeas: ['Werkzeugrolle', 'Ersatzriemen', 'kleines Batterietestgeraet', 'Servicezettel'],
            returnDrivers: ['Materialbedarf wird in der Basis nachbestellt', 'der naechste Versorgungslauf braucht die Fehlerliste', 'Servicefreigabe wird in der Basis abgeschlossen'],
            accessReasons: ['naechster Strip zur Aussenstelle', 'schnellster Rueckweg mit empfindlichen Kleinteilen', 'Camp-Zugang ohne langen Rueckmarsch']
        },
        {
            id: 'lodge_guest_logistics',
            familyId: 'lodge_logistics',
            label: 'Lodge-, Ranch- oder Outfitter-Logistik',
            tags: ['lodge', 'ranch', 'camp', 'remote_strip'],
            weight: 1.0,
            roleIdeas: ['Lodge-Koordinatorin', 'Outfitter-Kontakt', 'Ranch-Caretaker'],
            taskIdeas: ['Gaesteliste und Vorratszettel abgestimmt', 'Camp-Schluessel und Funkliste eingesammelt', 'Saisonbedarf fuer den naechsten Turnaround gezaehlt'],
            objectIdeas: ['Klemmbrett', 'Schluesselbund', 'Posttasche', 'kleine Vorratskiste'],
            returnDrivers: ['in der Basis wartet die naechste Gaesteplanung', 'Fracht- und Crewrotation wird dort angepasst', 'die Abendbesprechung braucht den aktuellen Stand'],
            accessReasons: ['Treffpunkt zwischen Lodge und Strip', 'Abholpunkt fuer Crewwechsel', 'sicherster kurzer Weg aus dem Tal']
        },
        {
            id: 'wildlife_count_monitor',
            familyId: 'wildlife_fieldwork',
            label: 'Wildlife- und Habitat-Monitoring',
            tags: ['forest', 'meadow', 'water', 'wildlife', 'remote_strip'],
            weight: 0.95,
            roleIdeas: ['Wildlife-Mitarbeiter', 'Habitat-Koordinatorin', 'Forstbiologe'],
            taskIdeas: ['Kamerakarten eingesammelt', 'Spurenpunkte und Zaunluecken notiert', 'Ufer- und Wiesenabschnitt auf Stoerstellen geprueft'],
            objectIdeas: ['Kamerakarten-Box', 'Feldnotizbuch', 'GPS-Handgeraet', 'kleine Rueckholtasche'],
            returnDrivers: ['die Karten werden in der Basis gesichert', 'Forstteam braucht die Fundpunkte fuer die Wochenplanung', 'Stoerstellen sollen vor dem naechsten Crewgang gemeldet werden'],
            accessReasons: ['Strip liegt nahe an mehreren Kontrollpunkten', 'kurzer Weg vom Beobachtungsbogen zum Abholpunkt', 'besserer Rueckweg als mehrere Stunden Talabstieg']
        },
        {
            id: 'map_photo_scout',
            familyId: 'mapping_photo',
            label: 'Karten-, Foto- oder Projekt-Dokumentation',
            tags: ['mapping', 'photo', 'ranch', 'water', 'mountain', 'remote_strip'],
            weight: 0.95,
            roleIdeas: ['Kartenmacherin', 'Projektfotograf', 'Dokumentationsleiterin'],
            taskIdeas: ['Referenzfotos vom Stripumfeld gemacht', 'Kartennotizen und Wegpunkte abgeglichen', 'Fotokarten fuer die Projektakte sortiert'],
            objectIdeas: ['Fototasche', 'Kartenrolle', 'Tablet', 'Akkucase'],
            returnDrivers: ['Projektleitung braucht die Bilder vor der Freigabe', 'Kartenstand muss in der Basis aktualisiert werden', 'Akkus und Datentraeger sollen nicht draussen bleiben'],
            accessReasons: ['Strip ist der einzige klare Zugang zum Bildbereich', 'Treffpunkt mit Sicht auf Tal und Bahnrand', 'schnellster Rueckweg fuer die Datenkarten']
        },
        {
            id: 'permit_boundary_admin',
            familyId: 'permit_admin',
            label: 'Permit-, Grenz- oder Betriebsunterlagen',
            tags: ['admin', 'ranch', 'forest', 'remote_strip'],
            weight: 0.9,
            roleIdeas: ['Permit-Koordinator', 'Rangerstation-Kontakt', 'Projektleiterin vor Ort'],
            taskIdeas: ['Nutzungsnotizen mit der Aussenstelle abgeglichen', 'Grenzmarken und alte Wegpunkte fotografiert', 'Unterschriftenmappe und Betriebszettel eingesammelt'],
            objectIdeas: ['Dokumentenmappe', 'Funkliste', 'Tablet', 'versiegelte Posttasche'],
            returnDrivers: ['Unterlagen gehoeren zurueck in die Basisakte', 'naechste Freigabe haengt an den Rueckmeldungen', 'Projektbesprechung braucht die Originalnotizen'],
            accessReasons: ['neutraler Treffpunkt fuer mehrere Teams', 'sicherer Abholpunkt fuer Unterlagen', 'kein langer Transport ueber raues Gelaende']
        },
        {
            id: 'weather_lookout_station',
            familyId: 'weather_observer',
            label: 'Wetter-, Pegel- oder Lookout-Meldung',
            tags: ['weather', 'cold', 'mountain', 'water', 'forest'],
            weight: 0.9,
            roleIdeas: ['Lookout-Beobachterin', 'Wetterposten-Kontakt', 'Pegelwart'],
            taskIdeas: ['Wind- und Sichtnotizen mit alten Messpunkten abgeglichen', 'Pegelmarken kontrolliert', 'Wetterfenster fuer die naechste Crew gemeldet'],
            objectIdeas: ['Wetterkladde', 'Handfunkgeraet', 'kleine Instrumententasche', 'Akkupack'],
            returnDrivers: ['Basis braucht die Lage fuer die Morgenplanung', 'Wetterstand gehoert in die naechste Schichtbesprechung', 'Daten werden im Crewbriefing uebergeben'],
            accessReasons: ['kurzer Zugang zu Lookout oder Pegelpunkt', 'sicherer Treffpunkt vor Wetterwechsel', 'Rueckflug spart langen Abstieg im Dunkeln']
        },
        {
            id: 'camp_crew_rotation',
            familyId: 'crew_rotation',
            label: 'Camp-Crew, Saisonarbeit oder Crewwechsel',
            tags: ['camp', 'lodge', 'ranch', 'remote_strip'],
            weight: 1.05,
            roleIdeas: ['Camp-Koordinatorin', 'Saisonarbeiter', 'Crew-Vorarbeiter'],
            taskIdeas: ['Crewwechsel vorbereitet', 'Materialliste und offene Reparaturen notiert', 'Camp sauber uebergeben und Funkliste aktualisiert'],
            objectIdeas: ['Seesack', 'Klemmbrett', 'kleine Werkzeugkiste', 'Postbeutel'],
            returnDrivers: ['naechste Crew wird in der Basis gebrieft', 'Arbeitsstunden und Materialbedarf gehen ins System', 'die Rueckfahrt vom Heimatplatz ist der naechste logische Schritt'],
            accessReasons: ['Strip ist der Wechselpunkt fuer das Camp', 'zu Fuss waere der Rueckweg zu lang', 'kurzer Turnaround zwischen zwei Crewfenstern']
        },
        {
            id: 'insurance_site_reviewer',
            familyId: 'insurance_review',
            label: 'Versicherungs-, Eigentums- oder Schadenssichtung',
            tags: ['ranch', 'road', 'maintenance', 'weather', 'remote_strip'],
            weight: 0.85,
            roleIdeas: ['Versicherungsprueferin', 'Schadensgutachter', 'Property-Managerin'],
            taskIdeas: ['Fotos von Zaun, Zufahrt und Nebengebaeude gesichert', 'Sturmschaden und Spurrinnen protokolliert', 'Rueckfragen mit dem lokalen Kontakt geklaert'],
            objectIdeas: ['Fototablet', 'Schadenmappe', 'Massband', 'kleiner Aktenkoffer'],
            returnDrivers: ['Schadennummer wird in der Basis weiterbearbeitet', 'Freigabe fuer Material und Reparatur haengt an den Bildern', 'Eigentuemer wartet in der Basis auf die Einschaetzung'],
            accessReasons: ['Strip ist der einzig praktikable Zugang zum Objekt', 'Treffpunkt ohne lange Pistenfahrt', 'Rueckflug bringt Originalnotizen zurueck zur Basis']
        },
        {
            id: 'relay_cache_courier',
            familyId: 'comms_cache',
            label: 'Funk, Cache oder Kommunikationsmaterial',
            tags: ['maintenance', 'power', 'forest', 'mountain', 'remote_strip'],
            weight: 0.9,
            roleIdeas: ['Funkwartin', 'Kommunikationshelfer', 'Cache-Koordinatorin'],
            taskIdeas: ['Akkus getauscht', 'Funkcache versiegelt', 'Antennenstand und Reichweitennotizen geprueft'],
            objectIdeas: ['Alukoffer', 'Akkutasche', 'Funkliste', 'versiegelter Cache-Beutel'],
            returnDrivers: ['Frequenz- und Akkuliste gehoeren zurueck in die Basis', 'Ersatzteile fuer den naechsten Lauf werden dort gepackt', 'Dienstplan haengt an der Rueckmeldung'],
            accessReasons: ['Strip liegt am besten zum Relaiszugang', 'kurzer Weg vom Cache zum Abholpunkt', 'Rueckflug vermeidet Uebernachtung am Funkposten']
        },
        {
            id: 'quirky_field_kitchen',
            familyId: 'wildcard_camp',
            label: 'Kurioser Camp-Auftrag ohne Drama',
            tags: ['camp', 'lodge', 'ranch', 'wildcard', 'remote_strip'],
            wildcard: true,
            weight: 0.55,
            roleIdeas: ['Camp-Koch', 'Backcountry-Eventhelferin', 'Lodge-Allrounder'],
            taskIdeas: ['defekten Kuehlbox-Deckel und Essensliste dokumentiert', 'Campinventar nach einem langen Wochenende gezaehlt', 'eine vergessene Sonderbestellung fuer die Basis gesichert'],
            objectIdeas: ['Kuehlboxdeckel', 'Bestellzettel', 'Emailletopf', 'kleine Vorratskiste'],
            returnDrivers: ['Basis passt die naechste Versorgungsliste an', 'Lodge-Team wartet auf den Fehlbestand', 'der naechste Flug soll nicht mit falscher Kuechenfracht starten'],
            accessReasons: ['Strip ist der einzige schnelle Weg aus dem Camp', 'Treffpunkt am Gelaendewagen statt langer Rueckfahrt', 'kurzer Abholpunkt nach Camp-Schluss']
        }
    ];

    const BUSH_SUPPLY_STRIP_CANDIDATES = [
        {
            id: 'ranger_cache_restock',
            familyId: 'ranger_cache',
            label: 'Ranger-Cache und Streckenbetrieb',
            tags: ['forest', 'trail', 'remote_strip', 'maintenance'],
            weight: 1.1,
            roleIdeas: ['Rangerstation-Kontakt', 'Trail-Crew am Zielstrip', 'Backcountry-Permit-Team'],
            taskIdeas: ['Markierungsband und neue Trailkarten uebergeben', 'Cache fuer den naechsten Crewgang auffuellen', 'Sperrnotizen und Funkliste mit der Bodencrew abgleichen'],
            objectIdeas: ['Markierungsband', 'Trailkarten', 'Funkbatterien', 'versiegelte Cache-Kiste'],
            returnDrivers: ['die naechste Trail-Crew braucht das Material vor dem Morgenlauf', 'Permit- und Sperrplanung wird nach der Uebergabe angepasst', 'die Rangerstation erwartet Rueckmeldung zur Cache-Menge'],
            accessReasons: ['der Strip ist der kuerzeste Zugang zum oberen Trailabschnitt', 'das Material waere ueber Land zu sperrig', 'die Crew wartet am sicheren Abladepunkt am Striprand']
        },
        {
            id: 'camp_turnaround_supply',
            familyId: 'camp_logistics',
            label: 'Camp-Turnaround und Saisonbedarf',
            tags: ['camp', 'lodge', 'ranch', 'remote_strip'],
            weight: 1.05,
            roleIdeas: ['Camp-Koordinatorin', 'Lodge-Allrounder', 'Outfitter-Crew'],
            taskIdeas: ['Frischware und trockene Vorratskisten fuer den Crewwechsel absetzen', 'Werkzeug und Verbrauchsmaterial fuer die naechste Belegung uebergeben', 'Postbeutel und Bestellzettel beim Campkontakt lassen'],
            objectIdeas: ['Vorratskisten', 'Postbeutel', 'Werkzeugrolle', 'kleiner Ersatzteilkarton'],
            returnDrivers: ['das Camp kann den naechsten Turnaround ohne Zusatzfahrt starten', 'die Basis bekommt nach dem Abladen den Bestand bestaetigt', 'das Lodge-Team plant danach den naechsten Umlauf'],
            accessReasons: ['der Zielstrip ist der direkte Camp-Zugang', 'am Camp-Pfad gibt es einen klaren Abladepunkt', 'kurzer Luftweg spart eine lange, raue Zufahrt']
        },
        {
            id: 'comms_battery_delivery',
            familyId: 'comms_power',
            label: 'Funk- und Batterieversorgung',
            tags: ['power', 'maintenance', 'forest', 'mountain'],
            weight: 1.0,
            roleIdeas: ['Funkwart am Ziel', 'USFS-Technikteam', 'Kommunikationshelfer'],
            taskIdeas: ['geladene Funkakkus und Ersatzhandgeraete abliefern', 'Batterieliste mit der Aussenstelle abgleichen', 'kleines Antennen- und Ladekit fuer den Wochenbetrieb uebergeben'],
            objectIdeas: ['Akkucase', 'Handfunkgeraete', 'Antennenkit', 'Ladegeraet in Schaumkoffer'],
            returnDrivers: ['die Funkversorgung fuer den naechsten Einsatzabschnitt bleibt stabil', 'die Basis aktualisiert danach die Akkurotation', 'der folgende Crewflug kann ohne Zusatzfracht geplant werden'],
            accessReasons: ['der Strip liegt am besten zum Funkzugang', 'die Akkus sollen nicht ueber holprige Zufahrt transportiert werden', 'der Kontakt wartet am kurzen Weg vom Relaispfad']
        },
        {
            id: 'pump_water_utility',
            familyId: 'water_utility',
            label: 'Wasser, Pumpe und Utility-Material',
            tags: ['water', 'power', 'camp', 'maintenance'],
            weight: 0.95,
            roleIdeas: ['Pumpenmechaniker', 'Camp-Wartin', 'Utility-Kontakt'],
            taskIdeas: ['Pumpendichtung und Testschlauch absetzen', 'Wasserfilter und Ersatzriemen fuer den Campbetrieb uebergeben', 'Servicezettel fuer die Aussenstelle mitliefern'],
            objectIdeas: ['Pumpendichtung', 'Filterkarton', 'Ersatzriemen', 'Serviceumschlag'],
            returnDrivers: ['die Wasserversorgung kann vor der naechsten Belegung geprueft werden', 'die Basis braucht nach der Uebergabe nur noch die Materialbestaetigung', 'der Utility-Kontakt kann den Testlauf noch bei Tageslicht machen'],
            accessReasons: ['der Strip ist der einzige sinnvolle Zugang zum Pumpenhaus', 'das Material ist klein, aber dringend fuer den Campbetrieb', 'der Abladepunkt liegt direkt am Pfad zur Wasserstelle']
        },
        {
            id: 'medical_vet_cache',
            familyId: 'medical_cache',
            label: 'Medizin-, Vet- oder Notfallcache',
            tags: ['camp', 'ranch', 'forest', 'remote_strip'],
            weight: 0.9,
            roleIdeas: ['Ranch-Caretaker', 'Camp-Medic', 'Backcountry-Vet-Kontakt'],
            taskIdeas: ['versiegelte Medkits und Kuehlpacks ersetzen', 'Vet-Material fuer Arbeitstiere am Camp absetzen', 'Notfallliste und Ablaufkarte aktualisieren'],
            objectIdeas: ['versiegelte Medkit-Kiste', 'Kuehlpack-Tasche', 'Vet-Materialkarton', 'Notfallmappe'],
            returnDrivers: ['der Cache ist wieder einsatzbereit fuer die Saison', 'die Basis vermerkt den Austausch im Bestand', 'der naechste Crewgang muss kein medizinisches Grundmaterial schleppen'],
            accessReasons: ['der Strip liegt naeher am Cache als jede Strasse', 'das Material soll kontrolliert und sauber uebergeben werden', 'der lokale Kontakt kann die Kiste direkt einlagern']
        },
        {
            id: 'survey_marker_supply',
            familyId: 'survey_mapping',
            label: 'Vermessung, Marker und Kartenarbeit',
            tags: ['mapping', 'ranch', 'forest', 'road'],
            weight: 0.9,
            roleIdeas: ['Vermessungsteam', 'Projektleiterin am Strip', 'Boundary-Crew'],
            taskIdeas: ['Grenzmarker, Farbpatronen und Kartenrolle abliefern', 'neue Wegpunktliste fuer den naechsten Abschnitt uebergeben', 'Foto- und Messzettel fuer die Crew bereitstellen'],
            objectIdeas: ['Kartenrolle', 'Grenzmarker', 'Farbpatronen', 'Messzettelmappe'],
            returnDrivers: ['die Bodencrew kann die Markierung ohne Basisfahrt fortsetzen', 'der Projektplan wird nach der Uebergabe freigegeben', 'die Kartenarbeit bleibt mit dem letzten Stand synchron'],
            accessReasons: ['der Strip ist der neutrale Treffpunkt mehrerer Gelaendeteams', 'die Marker muessen direkt an den Arbeitsrand', 'das Material waere ueber den Trail unhandlich']
        },
        {
            id: 'fire_cache_restock',
            familyId: 'fire_readiness',
            label: 'Brandschutz- und Bereitschaftsmaterial',
            tags: ['fire', 'forest', 'camp', 'maintenance'],
            weight: 0.85,
            roleIdeas: ['Fire-Cache-Kontakt', 'USFS-Bereitschaftsteam', 'Ranger-Crew am Strip'],
            taskIdeas: ['Schlauchkupplungen, Handschuhe und Funkakkus in den Cache bringen', 'Bereitschaftsliste mit der Crew abgleichen', 'kleines Werkzeug fuer den Pumpenstart absetzen'],
            objectIdeas: ['Schlauchkupplungen', 'Arbeitshandschuhe', 'Funkakku-Box', 'Pumpenwerkzeug'],
            returnDrivers: ['der Cache ist fuer ein moegliches Wetterfenster vorbereitet', 'die Basis kann den Bereitschaftsstatus aktualisieren', 'die naechste Crew weiss, was vor Ort liegt'],
            accessReasons: ['der Strip ist der schnellste Zugang zum Fire-Cache', 'der Kontakt wartet am sicheren Abladepunkt', 'das Material bleibt nahe am moeglichen Einsatzrand']
        },
        {
            id: 'odd_lodge_supply',
            familyId: 'wildcard_camp',
            label: 'Kuriose Lodge-Versorgung ohne Drama',
            tags: ['lodge', 'camp', 'wildcard', 'remote_strip'],
            wildcard: true,
            weight: 0.5,
            roleIdeas: ['Lodge-Allrounder', 'Camp-Koch', 'Backcountry-Eventhelferin'],
            taskIdeas: ['Ersatzgriff fuer den alten Ofen und eine falsch gelieferte Kuechenkiste absetzen', 'Inventarzettel und kleines Sonderpaket beim Camp lassen', 'fehlende Teile fuer ein Wochenende draussen nachreichen'],
            objectIdeas: ['Ofengriff', 'Kuechenkiste', 'Inventarzettel', 'Sonderpaket'],
            returnDrivers: ['die Basis vermeidet damit einen zweiten Kleinstflug', 'das Camp kann den Abendbetrieb ohne Improvisation starten', 'der naechste Versorgungszettel wird danach korrigiert'],
            accessReasons: ['der Strip liegt direkt am Camp-Pfad', 'das Paket ist klein, aber vor Ort genau jetzt praktisch', 'der Campkontakt kann die Lieferung sofort uebernehmen']
        }
    ];

    const BUSH_CHARTER_STRIP_CANDIDATES = [
        {
            id: 'ranger_field_dropoff',
            familyId: 'ranger_fieldwork',
            label: 'Ranger-Dropoff fuer Feldarbeit',
            tags: ['forest', 'trail', 'remote_strip'],
            weight: 1.1,
            roleIdeas: ['USFS-Rangerin', 'Trail-Koordinator', 'Permit-Officer'],
            taskIdeas: ['frische Wegsperren vor Ort bestaetigen', 'Trailmarker und Besucherhinweise erneuern', 'kurzes Treffen mit einer draussen arbeitenden Crew halten'],
            objectIdeas: ['Tagesrucksack', 'Funkgeraet', 'Kartenmappe', 'Markierungsband'],
            returnDrivers: ['am Ziel beginnt ein Tagesauftrag im Gelaende', 'die Crew vor Ort wartet auf Entscheidung und Material', 'der Absetzflug spart mehrere Stunden Anmarsch'],
            accessReasons: ['der Strip ist der naechste brauchbare Zugang zum Trailabschnitt', 'vom Bahnrand fuehrt der kurze Pfad direkt zur Einsatzstelle', 'die Person muss mit leichtem Gepaeck in die Wildnis']
        },
        {
            id: 'lodge_manager_turnaround',
            familyId: 'lodge_logistics',
            label: 'Lodge- oder Ranch-Turnaround',
            tags: ['lodge', 'ranch', 'camp', 'remote_strip'],
            weight: 1.05,
            roleIdeas: ['Lodge-Manager', 'Ranch-Caretakerin', 'Outfitter-Koordinator'],
            taskIdeas: ['Gaestewechsel und Vorratsliste vor Ort klaeren', 'Schluessel, Post und kleine Ersatzteile an die Aussenstelle bringen', 'Crewplan fuer das kommende Wochenende abstimmen'],
            objectIdeas: ['Duffelbag', 'Schluesselbund', 'Posttasche', 'kleine Ersatzteilbox'],
            returnDrivers: ['am Ziel muss die Uebergabe vor dem naechsten Gaestefenster laufen', 'die Lodge braucht den Kontakt persoenlich vor Ort', 'nach der Landung beginnt der Turnaround am Camp'],
            accessReasons: ['der Strip ist der normale Zugang zur Lodge', 'die Zufahrt ist fuer einen kurzen Termin zu lang', 'der Passagier muss direkt am Camp-Pfad raus']
        },
        {
            id: 'photographer_assignment',
            familyId: 'photo_story',
            label: 'Foto-, Karten- oder Dokumentationstermin',
            tags: ['photo', 'mapping', 'water', 'mountain'],
            weight: 0.95,
            roleIdeas: ['Projektfotografin', 'Kartenmacher', 'Dokumentationsleiterin'],
            taskIdeas: ['Referenzbilder fuer eine Projektakte aufnehmen', 'Wegpunkte und Blickrichtungen am Strip abgleichen', 'Bilder fuer Betreiber oder Redaktion erstellen'],
            objectIdeas: ['Kameratasche', 'Tablet', 'Kartenrolle', 'Akkucase'],
            returnDrivers: ['das Licht- und Wetterfenster am Ziel passt heute', 'die Projektleitung braucht aktuelle Bilder', 'der Termin ist kurz, aber nur per Luftweg sinnvoll'],
            accessReasons: ['der Strip bietet direkten Zugang zum Bildmotiv', 'vom Ziel aus laesst sich der Abschnitt ohne langen Marsch erreichen', 'das Equipment bleibt mit dem Flugzeug handhabbar']
        },
        {
            id: 'biologist_access',
            familyId: 'wildlife_fieldwork',
            label: 'Biologie, Habitat oder Monitoring',
            tags: ['wildlife', 'forest', 'water', 'meadow'],
            weight: 0.95,
            roleIdeas: ['Forstbiologin', 'Habitat-Mitarbeiter', 'Wildlife-Koordinatorin'],
            taskIdeas: ['Kamerastandorte und Zaunluecken vor Ort kontrollieren', 'Ufer- und Wiesenpunkte fuer das Monitoring begehen', 'Datenkarten und Batterien in der Beobachtungsroute tauschen'],
            objectIdeas: ['Feldrucksack', 'Kamerakarten-Box', 'GPS-Handgeraet', 'leichte Batterietasche'],
            returnDrivers: ['das Monitoringfenster ist an Wetter und Tageslicht gebunden', 'die Daten sollen nach dem Einsatz in die Basis zurueck', 'die Person bleibt nur fuer den geplanten Feldblock draussen'],
            accessReasons: ['der Strip liegt nahe an mehreren Kontrollpunkten', 'der Zugang ueber Land waere zu lang fuer den Tagesblock', 'der Wartepunkt liegt am Anfang der Beobachtungsroute']
        },
        {
            id: 'maintenance_tech_dropoff',
            familyId: 'utility_service',
            label: 'Techniker am Ziel absetzen',
            tags: ['maintenance', 'power', 'camp', 'road'],
            weight: 0.9,
            roleIdeas: ['Generator-Techniker', 'Pumpenmechanikerin', 'Utility-Servicemitarbeiter'],
            taskIdeas: ['Generatorlauf und Sicherungskasten pruefen', 'Pumpenleitung und Filter am Camp warten', 'Zufahrtsgatter und Notfallkasten nachsehen'],
            objectIdeas: ['Werkzeugtasche', 'Ersatzriemen', 'Messgeraet', 'Serviceklemmbrett'],
            returnDrivers: ['der Techniker bleibt fuer den Arbeitsblock vor Ort', 'das Camp braucht die Wartung vor der naechsten Belegung', 'der Auftrag ist als Dropoff geplant, nicht als Rueckholung'],
            accessReasons: ['der Strip ist der direkte Zugang zur Aussenstelle', 'Werkzeug und Person kommen zusammen an', 'die Landung spart eine lange Materialfahrt']
        },
        {
            id: 'outfitter_client_transfer',
            familyId: 'outfitter_guest',
            label: 'Outfitter-, Angler- oder Campgast',
            tags: ['lodge', 'water', 'camp', 'ranch'],
            weight: 0.9,
            roleIdeas: ['Outfitter-Gast', 'Fly-Fishing-Guide', 'Campgast mit Guidekontakt'],
            taskIdeas: ['Ausrüstung fuer ein ruhiges Wochenende am Wasser absetzen', 'Guidekontakt am Strip treffen', 'leichte Campausruestung zum Startpunkt bringen'],
            objectIdeas: ['Angelrohr', 'Duffelbag', 'Tagesrucksack', 'leichte Kuehltasche'],
            returnDrivers: ['am Ziel startet ein geplanter Aufenthalt', 'der Guide wartet am Striprand', 'der Gast muss vor dem Nachmittagsfenster draussen sein'],
            accessReasons: ['der Strip ist der uebliche Einstieg zum Camp', 'der Flussabschnitt ist vom Ziel aus schnell erreichbar', 'das Gepaeck passt besser in den Flug als auf einen langen Trail']
        },
        {
            id: 'boundary_survey_visit',
            familyId: 'survey_mapping',
            label: 'Vermessungs- oder Property-Termin',
            tags: ['mapping', 'ranch', 'road', 'maintenance'],
            weight: 0.85,
            roleIdeas: ['Vermessungsleiterin', 'Property-Manager', 'Versicherungsprueferin'],
            taskIdeas: ['Grenzmarken und alte Wegpunkte vor Ort bestaetigen', 'Fotos von Zaun, Zufahrt und Nebengebaeude machen', 'kurzen Ortstermin mit lokalem Kontakt halten'],
            objectIdeas: ['Messstab', 'Aktenkoffer', 'Fototablet', 'Kartenrolle'],
            returnDrivers: ['der Termin muss vor der naechsten Entscheidung vor Ort stattfinden', 'Originalnotizen werden spaeter in der Basis gebraucht', 'der Kontakt wartet am Strip, nicht in der Stadt'],
            accessReasons: ['der Strip ist der praktische Zugang zum Property-Termin', 'die Pistenfahrt waere fuer einen Kurztermin unverhaeltnismaessig', 'die Person muss mit Akten und Messzeug direkt raus']
        },
        {
            id: 'quiet_writer_residency',
            familyId: 'wildcard_guest',
            label: 'Kurioser Gast mit harmloser Backcountry-Agenda',
            tags: ['lodge', 'camp', 'wildcard', 'remote_strip'],
            wildcard: true,
            weight: 0.5,
            roleIdeas: ['Naturautor', 'Lodge-Kuenstlerin', 'Backcountry-Kursleiterin'],
            taskIdeas: ['einen kurzen Workshop oder Rechercheblock am Camp beginnen', 'Skizzen, Notizen oder Kursmaterial am Ziel auspacken', 'mit dem Campkontakt einen stillen Arbeitsplatz klaeren'],
            objectIdeas: ['Notizrolle', 'kleiner Malkasten', 'Kursmappe', 'Duffelbag'],
            returnDrivers: ['der Aufenthalt ist geplant und unkritisch', 'der Zielstrip ist nur der Eingang in die draussen liegende Arbeit', 'die Geschichte darf ungewoehnlich sein, bleibt aber ein normaler Charter'],
            accessReasons: ['der Strip ist der einzige schnelle Zugang zum ruhigen Camp', 'das Gepaeck ist klein, aber fuer den Trail unpraktisch', 'der Campkontakt holt die Person am Bahnrand ab']
        }
    ];

    const BUSH_SCENIC_HOPPER_CANDIDATES = [
        {
            id: 'photo_hiker_daytrip',
            familyId: 'photo_hike',
            label: 'Foto- und Wandertag',
            tags: ['photo', 'mountain', 'trail', 'remote_strip'],
            weight: 1.05,
            roleIdeas: ['Fotografin', 'Outdoor-Guide', 'Backcountry-Gast'],
            taskIdeas: ['Morgenlicht und Talblick am Zielstrip nutzen', 'einen kurzen Hike ab dem Bahnrand starten', 'Kamera und Tagesrucksack fuer ein paar Stunden draussen mitnehmen'],
            objectIdeas: ['Kameratasche', 'Tagesrucksack', 'Wanderstock', 'leichte Jacke'],
            returnDrivers: ['der Adventure-Leg endet sauber mit der Landung am Zielstrip', 'der Gast bleibt dort fuer den geplanten Ausflug', 'das Wetterfenster macht die Landung heute reizvoll'],
            accessReasons: ['der Strip ist der beste Einstieg in den Aussichtspunkt', 'vom Ziel aus beginnt der kurze Trail', 'der Flug ist Teil des Backcountry-Erlebnisses']
        },
        {
            id: 'fly_fishing_hop',
            familyId: 'river_guest',
            label: 'Fly-Fishing- oder Flussausflug',
            tags: ['water', 'camp', 'lodge', 'remote_strip'],
            weight: 0.95,
            roleIdeas: ['Fly-Fishing-Gast', 'Guide', 'Lodge-Gast'],
            taskIdeas: ['am Ziel in Richtung Wasserabschnitt weitergehen', 'Angelrohr und leichte Kuehltasche am Strip ausladen', 'den Guidekontakt am Camp-Pfad treffen'],
            objectIdeas: ['Angelrohr', 'Tagesrucksack', 'Kuehltasche', 'Watjacke'],
            returnDrivers: ['der Zielstrip ist der geplante Beginn des Tages am Wasser', 'nach der Landung startet der Ausflug ohne weiteren Transfer', 'der Flug ist bewusst ein kurzer Bush-Hop'],
            accessReasons: ['der Flussabschnitt liegt naeher am Zielstrip als an jeder Strasse', 'der Guide wartet am Striprand', 'das Gepaeck bleibt fuer den kurzen Flug handlich']
        },
        {
            id: 'geology_scenic_stop',
            familyId: 'geo_guest',
            label: 'Geologie, Landschaft und kurze Bodenpause',
            tags: ['mountain', 'mapping', 'photo', 'remote_strip'],
            weight: 0.9,
            roleIdeas: ['Geologie-Dozentin', 'Naturkundler', 'Karteninteressierter Gast'],
            taskIdeas: ['Gesteinslinien und Hangformen aus der Luft sehen', 'am Ziel ein paar Fotos und Notizen machen', 'den Strip als ruhigen Aussichtspunkt nutzen'],
            objectIdeas: ['Notizbuch', 'kleine Lupe', 'Kameratasche', 'Kartenrolle'],
            returnDrivers: ['die Landung am Ziel ist der geplante Hoehepunkt des Hoppers', 'der Gast bekommt den Backcountry-Kontext aus Luft und Bodenperspektive', 'es gibt keinen Folgeauftrag ausser dem sauberen Abschluss am Strip'],
            accessReasons: ['der Strip liegt gut fuer Blick auf Tal und Hang', 'eine kurze Landung macht den Scenic-Leg greifbar', 'die Route bleibt ein entspannter Adventure-Flug']
        },
        {
            id: 'lodge_guest_short_hop',
            familyId: 'lodge_guest',
            label: 'Lodge-Gast mit kurzem Backcountry-Hop',
            tags: ['lodge', 'camp', 'ranch', 'remote_strip'],
            weight: 0.9,
            roleIdeas: ['Lodge-Gast', 'Camp-Besucherin', 'Outfitter-Kontakt'],
            taskIdeas: ['am Zielstrip vom Campkontakt abgeholt werden', 'leichte Tasche und Tageskit am Bahnrand ausladen', 'den Anflug als Teil des Aufenthalts erleben'],
            objectIdeas: ['Duffelbag', 'Tagesrucksack', 'leichte Kuehltasche', 'Kameratasche'],
            returnDrivers: ['der Aufenthalt beginnt nach der Landung am Ziel', 'der Handoff ist einfach: Gast und Gepaeck raus, Flug abgeschlossen', 'die Story bleibt ruhig und freizeitnah'],
            accessReasons: ['der Strip ist der Zugang zur Lodge', 'Camp-Pfad und Bahnrand liegen nahe beieinander', 'der Hop ersetzt eine lange holprige Zufahrt']
        },
        {
            id: 'wildlife_watch_guest',
            familyId: 'wildlife_watch',
            label: 'Wildlife- und Naturbeobachtung',
            tags: ['wildlife', 'forest', 'meadow', 'water'],
            weight: 0.85,
            roleIdeas: ['Naturbeobachter', 'Fotografin', 'Guide-Gast'],
            taskIdeas: ['Lichtung, Ufer und Waldrand aus der Luft lesen', 'am Ziel ruhig aussteigen und Beobachtungspunkt erreichen', 'Kamera und Fernglas griffbereit halten'],
            objectIdeas: ['Fernglas', 'Kameratasche', 'Tagesrucksack', 'Feldnotizbuch'],
            returnDrivers: ['der kurze Hop liefert den besonderen Zugang zum Beobachtungsraum', 'der Aufenthalt beginnt ohne laute Logistik', 'die Landung ist der natuerliche Abschluss des Fluglegs'],
            accessReasons: ['der Strip liegt nahe am Beobachtungspunkt', 'die Umgebung passt zu einem stillen Outdoor-Aufenthalt', 'der Flug vermeidet einen langen Anmarsch']
        },
        {
            id: 'trailhead_family_visit',
            familyId: 'trailhead_visit',
            label: 'Trailhead-, Familien- oder Besuchsflug',
            tags: ['trail', 'camp', 'lodge', 'remote_strip'],
            weight: 0.85,
            roleIdeas: ['Backcountry-Besucherin', 'Trailhead-Gast', 'Camp-Freund'],
            taskIdeas: ['eine kleine Besuchstasche zum Ziel bringen', 'am Bahnrand vom Campkontakt abgeholt werden', 'ein kurzes Backcountry-Erlebnis ohne Arbeitsauftrag haben'],
            objectIdeas: ['kleiner Koffer', 'Tagesrucksack', 'Picknicktasche', 'Kamera'],
            returnDrivers: ['der Zielstrip ist der Treffpunkt fuer den geplanten Besuch', 'nach der Landung ist der Flugauftrag abgeschlossen', 'die Mission bleibt bewusst leicht und persoenlich'],
            accessReasons: ['der Strip ist der sichere Treffpunkt fuer den Besuch', 'der Camp-Pfad beginnt am Rand der Piste', 'der kurze Hop macht den Ort erreichbar']
        },
        {
            id: 'plein_air_artist',
            familyId: 'wildcard_scenic',
            label: 'Kurioser, ruhiger Scenic-Gast',
            tags: ['photo', 'camp', 'wildcard', 'remote_strip'],
            wildcard: true,
            weight: 0.5,
            roleIdeas: ['Landschaftsmalerin', 'Naturautor', 'Soundscape-Sammlerin'],
            taskIdeas: ['am Ziel einen stillen Arbeitsplatz suchen', 'Skizzenblock, Recorder oder kleine Staffelei ausladen', 'den Flug als Zugang zur Stimmung des Ortes nutzen'],
            objectIdeas: ['Skizzenrolle', 'kleiner Recorder', 'leichte Staffelei', 'Tagesrucksack'],
            returnDrivers: ['der Aufenthalt beginnt mit der Landung und braucht keine weitere Dramatik', 'der Zielstrip ist einfach der Zugang zu einem ungewoehnlichen, aber plausiblen Outdoor-Projekt', 'der Adventure-Hopper darf einmal etwas eigenwilliger wirken'],
            accessReasons: ['der Strip liegt nahe am Motiv', 'zu Fuss waere das Material unpraktisch', 'die kurze Landung macht den Ort erreichbar']
        }
    ];

    const BUSH_RECON_RETURN_CANDIDATES = [
        {
            id: 'storm_strip_damage',
            familyId: 'storm_damage',
            label: 'Strip-Zustand nach Wetter',
            tags: ['weather', 'remote_strip', 'maintenance', 'road'],
            weight: 1.15,
            roleIdeas: ['Airstrip-Inspektorin', 'Backcountry-Operationsleiter', 'Ranger-Koordinator'],
            taskIdeas: ['Spurrinnen, lose Aeste und Bahnrand aus der Luft einschaetzen', 'Windsack, Zufahrt und Parkpunkt auf sichtbare Schaeden pruefen', 'Anflugraum und Abrollbereich fuer den naechsten Flug beurteilen'],
            objectIdeas: ['Kamera', 'Strip-Checkliste', 'Funkmappe', 'Tablet'],
            returnDrivers: ['die Basis entscheidet danach ueber Freigabe oder Crewgang', 'der Betreiber braucht ein schnelles Lagebild ohne Landung', 'der naechste Versorgungsflug haengt am Befund'],
            accessReasons: ['der Strip selbst ist der Arbeitsraum', 'ein Ueberflug reicht fuer die erste Entscheidung', 'Landung ist nicht Teil des Recon-Auftrags']
        },
        {
            id: 'drainage_washout_recon',
            familyId: 'drainage_runoff',
            label: 'Drainage, Washout und Wasserlauf',
            tags: ['water', 'weather', 'road', 'remote_strip'],
            weight: 1.0,
            roleIdeas: ['Strip-Betreiber', 'USFS-Technikinspektorin', 'Utility-Koordinator'],
            taskIdeas: ['Drainagegraben und Washout-Spuren neben der Piste kontrollieren', 'Zufahrt, Gatter und Bodenverfaerbungen aus der Luft vergleichen', 'moegliche weiche Stellen fuer die Bodencrew markieren'],
            objectIdeas: ['Fototablet', 'Checkliste', 'Kartenfenster', 'Handfunkgeraet'],
            returnDrivers: ['die Bodencrew braucht Prioritaeten fuer den Reparaturlauf', 'die Basis entscheidet, ob ein schwererer Flug warten muss', 'der Befund wird nach Rueckkehr direkt eingetragen'],
            accessReasons: ['der Ueberflug zeigt Wasserlauf und Bahnrand zusammen', 'vom Cockpit laesst sich der Abschnitt ohne Bodenkontakt erfassen', 'der Rueckflug zur Basis ist Teil des Auftrags']
        },
        {
            id: 'wildlife_obstruction_recon',
            familyId: 'wildlife_obstruction',
            label: 'Wildlife, Zaun und Hindernisse',
            tags: ['wildlife', 'ranch', 'meadow', 'remote_strip'],
            weight: 0.9,
            roleIdeas: ['Ranger-Koordinator', 'Ranch-Caretakerin', 'Operationskontakt'],
            taskIdeas: ['Zaunluecken, Wildwechsel und Gegenstaende am Bahnrand suchen', 'Parkflaeche und Pistenkopf auf frische Spuren pruefen', 'sichtbare Hindernisse fuer den naechsten Anflug notieren'],
            objectIdeas: ['Kamera', 'Fernglas', 'Notizblock', 'Funkliste'],
            returnDrivers: ['die Basis warnt die naechste Crew nur bei belastbarem Befund', 'der Betreiber kann den Zauncheck gezielt ansetzen', 'der Recon spart eine unnoetige Bodenfahrt'],
            accessReasons: ['die Piste und der Wiesenrand sind aus der Luft gut lesbar', 'der Auftrag ist ein Lagebild, keine Landung', 'der Heimflug bringt die Notizen direkt zur Einsatzplanung']
        },
        {
            id: 'approach_corridor_recon',
            familyId: 'approach_corridor',
            label: 'Anflugraum und Hindernischeck',
            tags: ['mountain', 'forest', 'remote_strip', 'maintenance'],
            weight: 0.95,
            roleIdeas: ['Backcountry-Operationsleiterin', 'Forst-Ranger', 'Airstrip-Inspektor'],
            taskIdeas: ['Baumkronen, Hangschatten und neue Hindernisse im Anflugraum vergleichen', 'Windzeichen, Talverlauf und Ausweichpunkt kurz beurteilen', 'Fotos fuer ein aktualisiertes Anflugbriefing aufnehmen'],
            objectIdeas: ['Kamera', 'Anflugkarte', 'Tablet', 'Funkmappe'],
            returnDrivers: ['das Briefing fuer kommende Bush-Fluege wird nach Rueckkehr aktualisiert', 'die Basis braucht Fotos, bevor wieder Neulinge dorthin geplant werden', 'der Recon bleibt bewusst kurz und heimkehrpflichtig'],
            accessReasons: ['der Anflugraum ist der eigentliche Zielbereich', 'Landung wuerde den Auftrag nicht verbessern', 'aus der Luft sind Tal, Strip und Hindernisse zusammen erkennbar']
        },
        {
            id: 'camp_smoke_firewatch',
            familyId: 'fire_watch',
            label: 'Rauch-, Camp- oder Firewatch-Recon',
            tags: ['fire', 'forest', 'camp', 'weather'],
            weight: 0.85,
            roleIdeas: ['Firewatch-Koordinator', 'Rangerin', 'Backcountry-Operationskontakt'],
            taskIdeas: ['Rauchhinweis und Campumfeld aus sicherer Hoehe einordnen', 'Fire-Cache, Zufahrt und Pistenkopf kurz ueberfliegen', 'sichtbare Aktivitaet oder Fehlalarm fuer die Basis dokumentieren'],
            objectIdeas: ['Kamera', 'Firewatch-Liste', 'Funkgeraet', 'Kartenfenster'],
            returnDrivers: ['die Basis entscheidet danach, ob eine Bodencrew noetig ist', 'der Befund ersetzt keine Loescharbeit, sondern klaert den naechsten Schritt', 'der Rueckflug zur Basis schliesst den Recon ab'],
            accessReasons: ['der Strip dient als Orientierung fuer den Suchraum', 'der Auftrag bleibt ein Ueberflug ohne Landung', 'die Sicht aus der Luft ist fuer die Erstbewertung ausreichend']
        },
        {
            id: 'season_opening_recon',
            familyId: 'season_opening',
            label: 'Saisonstart und Betreibercheck',
            tags: ['remote_strip', 'lodge', 'ranch', 'maintenance'],
            weight: 0.9,
            roleIdeas: ['Betreiberkontakt', 'Lodge-Koordinatorin', 'Airstrip-Inspektorin'],
            taskIdeas: ['Piste, Parkpunkt und Zufahrt vor dem ersten Saisonflug ueberpruefen', 'Windsack, Markierungen und sichtbare Lagerstellen aus der Luft notieren', 'Betriebsakte mit frischen Fotos ergaenzen'],
            objectIdeas: ['Tablet', 'Betriebsmappe', 'Kamera', 'Checkliste'],
            returnDrivers: ['die Saisonplanung wartet auf den ersten belastbaren Befund', 'die Basis entscheidet, welche Fracht als erstes rausgeht', 'das Ergebnis wird nach der Landung daheim eingetragen'],
            accessReasons: ['der Zielstrip ist selbst der Pruefgegenstand', 'ein kurzer Ueberflug reicht fuer die Vorentscheidung', 'die Heimkehr gehoert zum Abschluss des Recon-Profils']
        },
        {
            id: 'odd_signage_recon',
            familyId: 'wildcard_recon',
            label: 'Kurioser Betreiberhinweis',
            tags: ['wildcard', 'remote_strip', 'ranch', 'maintenance'],
            wildcard: true,
            weight: 0.45,
            roleIdeas: ['Ranch-Caretaker', 'Betreiberkontakt', 'Backcountry-Operationsleiterin'],
            taskIdeas: ['ein gemeldetes verrutschtes Hinweisschild und ungewoehnliche Reifenspuren aus der Luft pruefen', 'Parkpunkt und Bahnrand kurz fotografieren', 'entscheiden, ob wirklich jemand rausfahren muss'],
            objectIdeas: ['Kamera', 'Notizblock', 'Strip-Skizze', 'Funkgeraet'],
            returnDrivers: ['die Basis klaert, ob der kleine Hinweis ein echter Arbeitsauftrag wird', 'der Betreiber bekommt eine schnelle Ja-Nein-Rueckmeldung', 'der Flug bleibt ein leichter Recon ohne Drama'],
            accessReasons: ['aus der Luft ist der Schildstandort schnell erkennbar', 'Landung lohnt fuer diesen Erstcheck nicht', 'der Rueckflug bringt die Antwort direkt heim']
        }
    ];

    const BUSH_PICKUP_CARGO_CANDIDATES = [
        {
            id: 'failed_generator_core',
            familyId: 'utility_repair_return',
            label: 'Defektes Generator- oder Pumpenteil',
            tags: ['power', 'maintenance', 'camp', 'remote_strip'],
            weight: 1.1,
            roleIdeas: ['Utility-Kontakt am Strip', 'Camp-Wartungsteam', 'Generator-Servicekontakt'],
            taskIdeas: ['defektes Generatormodul fuer die Werkstatt zurueckholen', 'Fehlerzettel und kleines Werkzeugcase mitnehmen', 'Ersatzteilbedarf in der Basis klaeren'],
            objectIdeas: ['Generatormodul', 'Werkzeugtasche', 'Fehlerzettel', 'kleine Oelwanne'],
            returnDrivers: ['die Werkstatt in der Basis kann erst mit dem Bauteil weiterarbeiten', 'der naechste Versorgungslauf braucht die Diagnose', 'das Camp wartet auf die Reparaturentscheidung'],
            accessReasons: ['das Teil liegt abholbereit am Zielstrip', 'Outbound bleibt leer fuer Gewicht und Platz', 'Rueckfracht ist der eigentliche Auftrag']
        },
        {
            id: 'camera_trap_cards',
            familyId: 'wildlife_data_return',
            label: 'Kamerafallen, Datenkarten und Akkus',
            tags: ['wildlife', 'forest', 'meadow', 'remote_strip'],
            weight: 0.95,
            roleIdeas: ['Wildlife-Team', 'Habitat-Koordinatorin', 'Ranger-Kontakt'],
            taskIdeas: ['Datenkarten und Akkus aus einem Monitoring-Cache heimholen', 'Kamerataschen und Feldnotizen zur Auswertung bringen', 'naechste Batterierotation vorbereiten'],
            objectIdeas: ['Kamerakarten-Box', 'Akkutasche', 'Feldnotizmappe', 'kleiner Hartschalenkoffer'],
            returnDrivers: ['die Daten sollen in der Basis gesichert werden', 'die Auswertung startet erst nach der Rueckfracht', 'das Monitoringteam plant danach die naechste Runde'],
            accessReasons: ['der Cache liegt nahe am Zielstrip', 'die Datentraeger sollen nicht draussen bleiben', 'das Gewicht passt gut als Rueckholfracht']
        },
        {
            id: 'water_sample_cooler',
            familyId: 'water_samples',
            label: 'Wasserproben oder Labor-Kuehlbox',
            tags: ['water', 'cold', 'camp', 'remote_strip'],
            weight: 0.95,
            roleIdeas: ['Hydrologie-Team', 'Pegelwart', 'Camp-Kontakt'],
            taskIdeas: ['Kuehlbox mit Proben und Pegelzetteln aufnehmen', 'versiegelte Behaelter in die Basis bringen', 'Laborfenster fuer die Auswertung halten'],
            objectIdeas: ['kleine Kuehlbox', 'Probenbehaelter', 'Pegelzettel', 'versiegelte Tasche'],
            returnDrivers: ['die Proben muessen in der Basis weitergekuehlt und erfasst werden', 'das Labor wartet auf die Behaelter', 'der Rueckflug ist der sichere Transportweg fuer empfindliches Material'],
            accessReasons: ['der Zielstrip liegt nahe am Probenpunkt', 'Rueckholfracht bleibt klein und empfindlich', 'Outbound leer schafft Platz fuer saubere Sicherung']
        },
        {
            id: 'permit_document_pouch',
            familyId: 'admin_documents',
            label: 'Unterlagen, Permits und Betriebsmappe',
            tags: ['admin', 'ranch', 'forest', 'remote_strip'],
            weight: 0.9,
            roleIdeas: ['Permit-Kontakt', 'Rangerstation', 'Projektleitung'],
            taskIdeas: ['unterschriebene Permits und Betriebsnotizen heimholen', 'Posttasche und Fotos aus dem Zielgebiet mitnehmen', 'Originalunterlagen fuer die Basisakte sichern'],
            objectIdeas: ['versiegelte Posttasche', 'Dokumentenmappe', 'Fototablet', 'kleiner Aktenkoffer'],
            returnDrivers: ['die Basis kann die Freigabe erst mit den Originalunterlagen abschliessen', 'der naechste Einsatz haengt an der Akte', 'Dokumente sollen nicht im Camp bleiben'],
            accessReasons: ['der Strip ist der sichere Uebergabepunkt fuer Unterlagen', 'die Rueckfracht ist klein, aber wichtig', 'eine Landroute waere fuer die Mappe zu langsam']
        },
        {
            id: 'lodge_inventory_return',
            familyId: 'lodge_inventory',
            label: 'Lodge-Inventar und Fehlbestand',
            tags: ['lodge', 'camp', 'ranch', 'remote_strip'],
            weight: 0.85,
            roleIdeas: ['Lodge-Team', 'Camp-Koordinator', 'Outfitter-Kontakt'],
            taskIdeas: ['Inventurliste, Schluessel und Fehlbestandkiste zur Basis bringen', 'Sonderbestellung und Rueckgabezeug aufnehmen', 'naechste Versorgungsliste in der Basis korrigieren'],
            objectIdeas: ['Inventurkiste', 'Schluesselbund', 'Bestellzettel', 'kleiner Rueckgabekarton'],
            returnDrivers: ['die Basis muss den naechsten Versorgungslauf sauber packen', 'die Lodge wartet auf korrigierte Bestellmengen', 'der Rueckflug vermeidet einen zweiten Kleinstlauf'],
            accessReasons: ['die Kiste steht am Striprand bereit', 'die Fracht ist leicht, aber organisatorisch wichtig', 'Outbound bleibt bewusst frei fuer die Rueckholung']
        },
        {
            id: 'relay_battery_case',
            familyId: 'comms_return',
            label: 'Leere Funkakkus und Relaismaterial',
            tags: ['power', 'maintenance', 'forest', 'mountain'],
            weight: 0.85,
            roleIdeas: ['Funkwart', 'Kommunikationshelferin', 'USFS-Technikteam'],
            taskIdeas: ['leere Akkucases und Reichweitennotizen zurueckbringen', 'defekten Handfunkkoffer fuer die Werkstatt aufnehmen', 'Relaiszettel und Frequenzliste sichern'],
            objectIdeas: ['Akkucase', 'Handfunkkoffer', 'Frequenzliste', 'Reichweitennotizen'],
            returnDrivers: ['die Basis rotiert Akkus und Ersatzgeraete fuer den naechsten Lauf', 'die Werkstatt braucht den defekten Koffer', 'die Frequenzliste wird daheim aktualisiert'],
            accessReasons: ['das Material ist am Zielstrip gesammelt', 'die Rueckfracht passt in einen kurzen RTB-Leg', 'der Kontakt will die Akkus nicht ueber den Trail tragen']
        },
        {
            id: 'field_tool_repair_return',
            familyId: 'tool_repair',
            label: 'Werkzeug, Messgeraet oder Reparaturkoffer',
            tags: ['maintenance', 'mapping', 'road', 'remote_strip'],
            weight: 0.85,
            roleIdeas: ['Feldteam', 'Vermessungsteam', 'Strip-Wartungskontakt'],
            taskIdeas: ['Messgeraet und Werkzeugrolle zur Kalibrierung heimholen', 'kurze Mangelnotiz und Fotokarte mitnehmen', 'Reparaturbedarf in der Basis klaeren'],
            objectIdeas: ['Messgeraet', 'Werkzeugrolle', 'Fotokarte', 'Mangelnotiz'],
            returnDrivers: ['die Kalibrierung passiert nur in der Basis', 'das Feldteam braucht vor dem naechsten Einsatz Ersatz', 'der Rueckflug schliesst den Materiallauf ab'],
            accessReasons: ['die Teile liegen am Wartepunkt am Strip', 'Outbound leer spart Gewicht fuer die Rueckfracht', 'ein Bodenweg waere fuer das Geraet unguenstig']
        },
        {
            id: 'odd_camp_return',
            familyId: 'wildcard_cargo',
            label: 'Kuriose Rueckholfracht ohne Drama',
            tags: ['wildcard', 'camp', 'lodge', 'remote_strip'],
            wildcard: true,
            weight: 0.45,
            roleIdeas: ['Camp-Kontakt', 'Lodge-Allrounder', 'Outfitter-Team'],
            taskIdeas: ['einen falsch gelieferten Ofeneinsatz und eine kleine Inventurtasche heimholen', 'Sonderteil zur Basis bringen, bevor es wieder im Camp vergessen wird', 'Bestellzettel und Rueckgabekarton zusammen sichern'],
            objectIdeas: ['Ofeneinsatz', 'Rueckgabekarton', 'Bestellzettel', 'Inventurtasche'],
            returnDrivers: ['die Basis korrigiert danach die naechste Lieferung', 'das Camp bekommt beim naechsten Lauf das richtige Teil', 'die Geschichte darf schraeg sein, bleibt aber reine Rueckholfracht'],
            accessReasons: ['die Kiste steht direkt am Striprand', 'das Teil ist klein, aber im Camp nutzlos', 'der RTB-Leg ist der sauberste Weg zurueck']
        }
    ];

    const POOLS = {
        bush_pickup_strip: BUSH_PICKUP_STRIP_CANDIDATES,
        bush_supply_strip: BUSH_SUPPLY_STRIP_CANDIDATES,
        bush_charter_strip: BUSH_CHARTER_STRIP_CANDIDATES,
        bush_scenic_hopper: BUSH_SCENIC_HOPPER_CANDIDATES,
        bush_recon_return: BUSH_RECON_RETURN_CANDIDATES,
        bush_pickup_cargo: BUSH_PICKUP_CARGO_CANDIDATES
    };

    function _storage() {
        try {
            if (root.localStorage) return root.localStorage;
        } catch (_) {}
        return null;
    }

    function _norm(text = '') {
        return String(text || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/ß/g, 'ss');
    }

    function _arr(value) {
        return Array.isArray(value) ? value.map(v => String(v || '').trim()).filter(Boolean) : [];
    }

    function missionVarietyPool(namespace = '') {
        const pool = POOLS[String(namespace || '').trim().toLowerCase()];
        return Array.isArray(pool) ? pool.map(item => ({ ...item })) : [];
    }

    function missionVarietyContextTags(context = {}, draft = {}, extra = {}) {
        const geo = context.targetGeoContext || context.geoContext || extra.targetGeoContext || {};
        const truth = context.missionTruth || extra.missionTruth || {};
        const weather = extra.weather || context.weather || context.missionWeather || {};
        const target = draft?.target || context.dest || context.target || {};
        const text = _norm([
            target.name, target.n, target.icao,
            context.selectedCategory, context.requestedCategory,
            context.dispatchProfileId, draft?.picker?.profile, draft?.category,
            geo.summary,
            ...(Array.isArray(geo.hints) ? geo.hints : []),
            ...(Array.isArray(truth.visibleCues) ? truth.visibleCues : []),
            truth?.mainTarget?.kind, truth?.sceneAnchor?.kind
        ].filter(Boolean).join(' '));
        const tags = new Set(['bush', 'remote_strip']);
        const addIf = (tag, re) => { if (re.test(text)) tags.add(tag); };
        addIf('water', /\b(water|river|creek|bach|fluss|ufer|lake|see|salmon|bar|pegel)\b/);
        addIf('forest', /\b(forest|wood|wald|forst|usfs|ranger|tree|trail)\b/);
        addIf('mountain', /\b(mountain|berg|peak|ridge|pass|canyon|valley|tal|fork)\b/);
        addIf('ranch', /\b(ranch|farm|pasture|meadow|wiese)\b/);
        addIf('lodge', /\b(lodge|camp|outfitter|cabins?|resort)\b/);
        addIf('road', /\b(road|track|zufahrt|gate|gatter|spur|parking)\b/);
        addIf('power', /\b(power|strom|generator|pump|pumpe|relay|relais|funk|antenna)\b/);
        addIf('maintenance', /\b(maintenance|wartung|technik|repair|service|inspection|check)\b/);
        const temp = Number(weather?.dest?.tempC ?? weather?.tempC);
        if (Number.isFinite(temp) && temp <= 3) tags.add('cold');
        const wind = Number(weather?.dest?.windKts ?? weather?.windKts);
        if (Number.isFinite(wind) && wind >= 10) tags.add('weather');
        if (Number(context?.missionFireHazard?.level || extra?.fireHazard?.level || 0) >= 3) tags.add('fire');
        return Array.from(tags);
    }

    function missionVarietyStorageKey(namespace = '', version = 'v1') {
        const safe = String(namespace || 'generic').toLowerCase().replace(/[^a-z0-9_:-]+/g, '_').slice(0, 80);
        return `${STORAGE_PREFIX}${safe}_${version}`;
    }

    function readMissionVarietyHistory(namespace = '', options = {}) {
        const store = _storage();
        if (!store) return [];
        const key = options.storageKey || missionVarietyStorageKey(namespace, options.version || 'v1');
        try {
            const parsed = JSON.parse(store.getItem(key) || '[]');
            return Array.isArray(parsed) ? parsed.filter(item => item && typeof item === 'object') : [];
        } catch (_) {
            return [];
        }
    }

    function writeMissionVarietyHistory(namespace = '', entry = {}, options = {}) {
        const store = _storage();
        if (!store || !entry || typeof entry !== 'object') return;
        const limit = Math.max(4, Math.min(80, Number(options.limit || DEFAULT_HISTORY_LIMIT) || DEFAULT_HISTORY_LIMIT));
        const key = options.storageKey || missionVarietyStorageKey(namespace, options.version || 'v1');
        const history = readMissionVarietyHistory(namespace, { ...options, storageKey: key });
        const familyIds = _arr(entry.familyIds).slice(0, 8);
        const candidateIds = _arr(entry.candidateIds).slice(0, 8);
        const compact = {
            ts: Number(entry.ts || Date.now()),
            namespace: String(namespace || entry.namespace || 'generic'),
            profileId: String(entry.profileId || ''),
            primaryFamilyId: String(entry.primaryFamilyId || familyIds[0] || ''),
            primaryCandidateId: String(entry.primaryCandidateId || candidateIds[0] || ''),
            familyIds,
            candidateIds,
            contextTags: _arr(entry.contextTags).slice(0, 12)
        };
        try { store.setItem(key, JSON.stringify(history.concat(compact).slice(-limit))); } catch (_) {}
    }

    function _recentSets(history = [], { familyLimit = 4, itemLimit = 8, primaryLimit = 10 } = {}) {
        const recentFamilies = new Set();
        const recentIds = new Set();
        const recentPrimaryFamilies = new Set();
        const recentPrimaryIds = new Set();
        history.slice(-Math.max(0, familyLimit)).forEach(entry => _arr(entry.familyIds).forEach(id => recentFamilies.add(id)));
        history.slice(-Math.max(0, itemLimit)).forEach(entry => _arr(entry.candidateIds).forEach(id => recentIds.add(id)));
        history.slice(-Math.max(0, primaryLimit)).forEach(entry => {
            const primaryFamily = String(entry.primaryFamilyId || _arr(entry.familyIds)[0] || '').trim();
            const primaryId = String(entry.primaryCandidateId || _arr(entry.candidateIds)[0] || '').trim();
            if (primaryFamily) recentPrimaryFamilies.add(primaryFamily);
            if (primaryId) recentPrimaryIds.add(primaryId);
        });
        return { recentFamilies, recentIds, recentPrimaryFamilies, recentPrimaryIds };
    }

    function _scoreCandidate(candidate, contextTags = []) {
        const ctx = new Set(contextTags);
        const tags = _arr(candidate.tags);
        const matches = tags.filter(tag => ctx.has(tag));
        const requiresAny = _arr(candidate.requiresAny);
        if (requiresAny.length && !requiresAny.some(tag => ctx.has(tag))) return null;
        const avoidAny = _arr(candidate.avoidAny);
        if (avoidAny.some(tag => ctx.has(tag))) return null;
        const base = Number(candidate.weight || 1) || 1;
        const score = Math.max(0.05, base + (matches.length * 0.55) + (candidate.wildcard ? -0.25 : 0));
        return { candidate, score, matches };
    }

    function _weightedPick(entries = []) {
        const total = entries.reduce((sum, entry) => sum + Math.max(0, Number(entry.score || 0)), 0);
        if (!(total > 0)) return entries[Math.floor(Math.random() * entries.length)] || null;
        let roll = Math.random() * total;
        for (const entry of entries) {
            roll -= Math.max(0, Number(entry.score || 0));
            if (roll <= 0) return entry;
        }
        return entries[entries.length - 1] || null;
    }

    function _compactCandidate(entry) {
        const c = entry?.candidate || entry || {};
        return {
            id: String(c.id || ''),
            familyId: String(c.familyId || c.id || ''),
            label: String(c.label || c.id || ''),
            wildcard: !!c.wildcard,
            matchTags: _arr(entry?.matches).slice(0, 6),
            roleIdeas: _arr(c.roleIdeas).slice(0, 4),
            taskIdeas: _arr(c.taskIdeas).slice(0, 4),
            objectIdeas: _arr(c.objectIdeas).slice(0, 4),
            returnDrivers: _arr(c.returnDrivers).slice(0, 4),
            accessReasons: _arr(c.accessReasons).slice(0, 3)
        };
    }

    function _unique(items = [], limit = 12) {
        return Array.from(new Set(items.map(v => String(v || '').trim()).filter(Boolean))).slice(0, limit);
    }

    function missionVarietyPackToPromptAxes(pack = null) {
        const candidates = Array.isArray(pack?.candidates) ? pack.candidates : [];
        return {
            roleFamilies: _unique(candidates.flatMap(c => c.roleIdeas || []), 12),
            activityVerbs: _unique(candidates.flatMap(c => c.taskIdeas || []), 14),
            evidenceObjects: _unique(candidates.flatMap(c => c.objectIdeas || []), 14),
            returnDrivers: _unique(candidates.flatMap(c => c.returnDrivers || []), 10),
            accessReasons: _unique(candidates.flatMap(c => c.accessReasons || []), 8)
        };
    }

    function selectMissionVarietyPack(options = {}) {
        const namespace = String(options.namespace || options.profileId || 'generic').trim().toLowerCase();
        const maxItems = Math.max(1, Math.min(8, Number(options.maxItems || 5) || 5));
        const wildcardRate = Math.max(0, Math.min(1, Number(options.wildcardRate ?? 0.18)));
        const candidates = Array.isArray(options.candidates) && options.candidates.length
            ? options.candidates.map(item => ({ ...item }))
            : missionVarietyPool(namespace);
        const contextTags = Array.isArray(options.contextTags) && options.contextTags.length
            ? _arr(options.contextTags)
            : missionVarietyContextTags(options.context || {}, options.draft || {}, options.extra || {});
        const history = options.history || readMissionVarietyHistory(namespace, options);
        const { recentFamilies, recentIds, recentPrimaryFamilies, recentPrimaryIds } = _recentSets(history, {
            familyLimit: Number(options.recentFamilyLimit || 4),
            itemLimit: Number(options.recentItemLimit || 8),
            primaryLimit: Number(options.recentPrimaryLimit || 10)
        });
        let scored = candidates
            .map(candidate => _scoreCandidate(candidate, contextTags))
            .filter(Boolean);
        if (!scored.length) {
            scored = candidates.map(candidate => ({ candidate, score: Number(candidate.weight || 1) || 1, matches: [] }));
        }
        const selected = [];
        const selectedIds = new Set();
        const selectedFamilies = new Set();
        const tryPick = (pool) => {
            const filtered = pool.filter(entry =>
                !selectedIds.has(String(entry.candidate.id || ''))
                && !selectedFamilies.has(String(entry.candidate.familyId || entry.candidate.id || ''))
            );
            const picked = _weightedPick(filtered);
            if (!picked) return false;
            selected.push(picked);
            selectedIds.add(String(picked.candidate.id || ''));
            selectedFamilies.add(String(picked.candidate.familyId || picked.candidate.id || ''));
            return true;
        };
        const primaryFresh = scored.filter(entry =>
            !recentPrimaryIds.has(String(entry.candidate.id || ''))
            && !recentPrimaryFamilies.has(String(entry.candidate.familyId || entry.candidate.id || ''))
        );
        const primaryFallback = scored.map(entry => {
            const isRecentPrimary = recentPrimaryIds.has(String(entry.candidate.id || ''))
                || recentPrimaryFamilies.has(String(entry.candidate.familyId || entry.candidate.id || ''));
            return isRecentPrimary ? { ...entry, score: Math.max(0.05, Number(entry.score || 0.05) * 0.25) } : entry;
        });
        tryPick(primaryFresh.length ? primaryFresh : primaryFallback);
        while (selected.length < maxItems) {
            const fresh = scored.filter(entry =>
                !recentIds.has(String(entry.candidate.id || ''))
                && !recentFamilies.has(String(entry.candidate.familyId || entry.candidate.id || ''))
            );
            if (!tryPick(fresh.length ? fresh : scored)) break;
        }
        if (Math.random() < wildcardRate && selected.length) {
            const wildcardPool = scored.filter(entry =>
                entry.candidate.wildcard
                && !selectedIds.has(String(entry.candidate.id || ''))
                && !recentIds.has(String(entry.candidate.id || ''))
            );
            const wildcard = _weightedPick(wildcardPool);
            if (wildcard) {
                selected[selected.length - 1] = wildcard;
            }
        }
        const compactCandidates = selected.map(_compactCandidate);
        const pack = {
            schema: 'missionVarietyPack.v1',
            namespace,
            profileId: String(options.profileId || namespace),
            contextTags,
            storageKey: missionVarietyStorageKey(namespace, options.version || 'v1'),
            selectedIds: compactCandidates.map(c => c.id),
            selectedFamilies: compactCandidates.map(c => c.familyId),
            primaryId: compactCandidates[0]?.id || '',
            primaryFamily: compactCandidates[0]?.familyId || '',
            recentFamilies: Array.from(recentFamilies),
            recentIds: Array.from(recentIds),
            recentPrimaryFamilies: Array.from(recentPrimaryFamilies),
            recentPrimaryIds: Array.from(recentPrimaryIds),
            candidates: compactCandidates,
            selectionRule: 'Kontextfilter zuerst; lokale Browser-History reduziert Wiederholungen; Wildcard bleibt profilkompatibel.'
        };
        pack.ingredientAxes = missionVarietyPackToPromptAxes(pack);
        if (options.writeHistory !== false) {
            writeMissionVarietyHistory(namespace, {
                namespace,
                profileId: options.profileId || namespace,
                primaryFamilyId: pack.primaryFamily,
                primaryCandidateId: pack.primaryId,
                familyIds: pack.selectedFamilies,
                candidateIds: pack.selectedIds,
                contextTags
            }, options);
        }
        root.gaMissionVarietyLastPack = pack;
        return pack;
    }

    root.MISSION_VARIETY_POOLS = POOLS;
    root.missionVarietyPool = missionVarietyPool;
    root.missionVarietyContextTags = missionVarietyContextTags;
    root.missionVarietyStorageKey = missionVarietyStorageKey;
    root.readMissionVarietyHistory = readMissionVarietyHistory;
    root.writeMissionVarietyHistory = writeMissionVarietyHistory;
    root.selectMissionVarietyPack = selectMissionVarietyPack;
    root.missionVarietyPackToPromptAxes = missionVarietyPackToPromptAxes;
})(typeof window !== 'undefined' ? window : globalThis);
