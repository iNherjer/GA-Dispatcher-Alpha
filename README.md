# VFR Multitool

Live: https://inherjer.github.io/VFR-Multitool/

Beta: https://inherjer.github.io/GA-Dispatcher-beta/

Das **VFR Multitool** ist ein browserbasiertes Cockpit-, Dispatch- und EFB-Werkzeug fuer VFR-Fluege im Microsoft Flight Simulator. Es kann einfache Freifluege begleiten, komplette Auftraege generieren, Routen und Hoehenprofile anzeigen, Live-GPS vom Simulator auf Tablet oder Zweitgeraet bringen und Fluege mit einer Crew teilen.

Das Tool ersetzt keine echte Flugvorbereitung. Es ist fuer den Flugsimulator gedacht.

## Schnellstart

1. App oeffnen und unter **DEP / Start** den Startplatz eingeben, zum Beispiel `EDTW`.
2. Flugzeugwerte pruefen: Preset waehlen oder **TAS**, **GPH**, **Cruise ALT** und **V/S** selbst setzen.
3. Fuer einen Auftrag **Typ**, **Distanz**, **Region** und **Richtung** waehlen und **Auftrag generieren / DISPATCH** klicken.
4. Fuer freie Navigation den **Kartentisch** oeffnen und **Direct To** nutzen.
5. Optional: **Pilot-ID + PIN** einrichten, damit Cloud-Sync, Crew Board und PC-Tracker zusammenarbeiten.

## Teil 1: Grundeinstellungen

### Darstellung und Bedienoberflaeche

Das VFR Multitool hat mehrere Oberflaechen, die dieselben Daten bedienen:

- **Modern**: kompakte Standardansicht.
- **Analog**: Retro-Cockpit mit mechanischer Anmutung.
- **NavCom**: Radio-Stack mit KLN-90B-artigem GPS-Display, DATA- und DISPATCH-Tasten.
- **Ops 1940**: stark instrumentenartige Missionsauswahl mit Piktogrammen.

Die Darstellung aenderst du in **Einstellungen > Darstellung**. Die **Seitengroesse** hilft auf iPad, Quest, Tablet oder kleinen Monitoren. Im Analog-Modus kann die obere linke Schraube die Panel-Lackierung wechseln.

Tipps:

- Wenn Text oder Bedienelemente zu klein wirken, zuerst **Seitengroesse** anpassen, nicht den Browser-Zoom.
- Auf iPad/iPhone die Seite ueber Safari mit **Zum Home-Bildschirm** installieren. Dann fuehlt sich die App eher wie eine PWA an.
- Der Versionshinweis unten kann ein Update erzwingen, falls der Browser eine alte Service-Worker-Version haelt.

### Flugzeugwerte und Presets

Die Flugzeugwerte bestimmen Zeiten, Fuel-Schaetzung, Profil und Missionsauswahl:

- **TAS**: geplante Reisegeschwindigkeit in Knoten.
- **GPH**: Verbrauch in US-Gallonen pro Stunde.
- **Cruise ALT**: geplante Reiseflughoehe fuer Route, Profil, Wetter- und Luftraumhinweise.
- **V/S Rate**: Steig- und Sinkrate fuer TOC/TOD und Profil.
- **Sitze / PAX**: begrenzt, wie viele Passagiere ein Auftrag einplanen darf.

Es gibt drei Schnellslots: **C172**, **Comanche / PA-24** und **Aerostar**. Unter **Aircraft > Presets** kannst du Name, TAS, GPH und PAX pro Slot speichern. Die Boarding-Szene kann ebenfalls pro Slot angepasst werden: Tuer, Marker, Wegpunkte, Reihenfolge und relative Positionen zum Flugzeug.

Tipps:

- Speichere deine haeufig genutzten Flugzeuge als Slots, statt vor jedem Dispatch die Slider neu zu setzen.
- Fuer langsame Busch- oder Trainingsfluege lieber realistische TAS eintragen, weil Distanz, ETE und Missionsdauer sonst falsch wirken.
- Boarding-Punkte nur anfassen, wenn Passagiere oder Marker im Simulator sichtbar falsch am Flugzeug stehen.

### KI-Dispatcher

Der **KI-Dispatcher** kann Briefings, Rollen, Fracht, Passagiere und lokale Geschichten erzeugen. Ohne API-Key nutzt die App lokale Daten und Fallbacks.

Einstellungen:

- **Schalter**: KI ein oder aus.
- **Provider**: Gemini oder OpenAI.
- **Profil**: Auto, Sparsam oder Qualitaet.
- **Gemini API-Key** und **OpenAI API-Key**: getrennte Felder.
- **FUEL-Anzeige**: grober Hinweis auf KI-Kontingent/Verbrauch.

Die API-Keys werden lokal im Browser gespeichert. Sie werden nicht in dein Pilotenprofil geschrieben. Browser-Erweiterungen oder ein kompromittiertes Geraet koennen lokale Browserdaten trotzdem auslesen.

Tipps:

- **Auto** ist der normale Betrieb. **Sparsam** ist sinnvoll, wenn du viele Missionen testest. **Qualitaet** lohnt sich fuer laengere Story-Briefings.
- Wenn ein Provider limitiert oder langsam ist, auf den anderen Provider wechseln oder KI kurz deaktivieren.
- Passagier-TTS und KI-Briefings koennen getrennt Kosten verursachen, je nach Provider und Einstellung.

### Pilot-ID, Cloud-Sync und PC-Tracker

Die **Pilot-ID** ist deine Identitaet fuer Sync, Crew und Live-Tracking. Der **PIN** schuetzt diese Identitaet.

Funktionen:

- **Login**: schaltet Cloud-Funktionen frei.
- **Auto-Sync**: laedt und speichert automatisch, wenn du angemeldet bist.
- **Push**: aktuellen Stand in die Cloud schreiben.
- **Pull**: Cloud-Stand auf dieses Geraet holen.
- **Live GPS**: zeigt, ob Daten vom PC-Tracker ankommen.
- Der Live-GPS-Status unterscheidet drei Stufen: `WAIT` bedeutet, dass nur die App am Relay verbunden ist; `LINK · v302` bestätigt den verbundenen PC-Tracker ohne frische Sim-Telemetrie; `LIVE · v302` zeigt aktive Telemetrie. Bei `LINK` und `LIVE` wird die erkannte Tracker-Version mit angezeigt.
- **PC-Tracker (.exe)**: sendet MSFS-Position, Hoehe, Kurs, Geschwindigkeit und Verkehr an die App.

PC-Tracker einrichten:

1. In der App **Pilot-ID + PIN** setzen und einloggen.
2. Am MSFS-PC den **VFR-Multitool-Tracker.exe** laden und starten.
3. Dieselbe Pilot-ID und denselben PIN eintragen.
4. Auf Tablet, iPad oder Zweit-PC die App mit derselben Pilot-ID oeffnen.

Der Tracker prueft Pilot-ID und PIN vor dem Verbindungsaufbau beim Sync-Dienst. Groß-/Kleinschreibung wird automatisch auf die gespeicherte Pilot-ID aufgeloest; erst nach erfolgreicher Pruefung meldet der Tracker die Anmeldung und startet die Live-Uebertragung.

Tipps:

- Die Reihenfolge ist unkritisch: Tracker und MSFS koennen vor oder nach der App starten.
- Wenn Live-GPS aktiv ist, nutzt **Direct To** automatisch die echte aktuelle Position als Start.
- Bei Sync-Konflikten nicht hektisch Push/Pull druecken. Erst pruefen, welches Geraet den gewuenschten Stand hat.

### Homebase planen und installieren

Die **Homebase Workbench** wird im Bereich **Einstellungen** geoeffnet. Dort lassen sich Hangar, Spawnpunkt und beliebig viele Ausstattungsobjekte auf der Karte platzieren, verschieben, drehen und in der Hoehe anpassen.

- Die Live-Vorschau benoetigt den produktiven PC-Tracker ab **v288** und eine aktive SimConnect-Verbindung.
- Der Tracker prueft das gemeinsame Homebase-Assetpaket und bietet neue Versionen nach ausdruecklicher Bestaetigung zum Download und zur Installation an.
- **Vorschau neu laden** baut die nicht kompilierten Arbeitsobjekte neu auf; ein bereits kompilierter Flugplatz bleibt davon getrennt.
- Die Planung wird sofort lokal und bei aktiviertem Auto-Sync 30 Sekunden nach der letzten Aenderung sowie beim Schliessen oder Verlassen geraeteuebergreifend gespeichert.
- Der SDK-Bau erzeugt das Homebase-Paket. Falls MSFS beendet werden muss, wartet der Tracker mit Wiederholungspruefungen auf das vollstaendige Prozessende.

Vor dem ersten Einsatz das angebotene Assetpaket installieren und danach Tracker, App und MSFS einmal gemeinsam neu starten.

### Missionsstatus, Reset und Auto Load

Der Bereich **Cloud & Mission** zeigt, was die laufende Mission erwartet: zum Beispiel Bodenstabilisierung, Boarding, Fracht oder naechsten Schritt.

- **Mission Reset** setzt die laufende Mission zurueck, ohne alle Einstellungen zu loeschen.
- **Auto Load** kann Missionsfracht automatisch laden, wenn die Mission dafuer vorbereitet ist.
- Bei akzeptierten Missionen werden Runtime, Passagier- und Cargo-Zustand separat von reinen EFB-/Freiflug-Briefings behandelt.

Tipps:

- Bei einer Mission, die nach Reload falsch aktiv wirkt, zuerst **Mission Reset** nutzen und dann neu akzeptieren.
- Freiflug/Direct-To ist EFB-only: keine versteckte Mission, kein Cargo-Start, keine Passagier-State-Machine.

### Hilfe, Update und Support

Unten in der App findest du:

- **Tutorial** fuer eine gefuehrte Einweisung.
- **Problem per E-Mail** fuer einen gekuerzten Debug-Bericht.
- **Debug Console** und **Pax Log** fuer Fehlersuche.
- Links zu **Impressum**, **Datenschutz**, **Daten & Lizenzen**, Discord und freiwilliger Unterstuetzung.

## Teil 2: Dispatch

### Grundprinzip

Dispatch erzeugt aus deinen Vorgaben einen Missionsentwurf. Danach kannst du ihn pruefen, annehmen, exportieren, pinnen oder im Kartentisch fliegen.

Wichtige Felder:

- **DEP / Start**: ICAO-Code oder Suchtext. Beispiel: `EDTW`.
- **DEST / Ziel**: optional. Leer, `RNDM` oder `----` bedeutet: die App sucht selbst.
- **TYPE / Typ**: APT, POI, Bush oder Spezialprofil.
- **RANGE / Distanz**: Egal, Short, Medium oder Long.
- **Region**: International, nur Deutschland oder Ausland.
- **Richtung**: bevorzugte Himmelsrichtung.
- **RDM / PICK**: Direkt zufaellig erzeugen oder erst 2-3 Vorschlaege anzeigen.

Tipps:

- Fuer maximale Abwechslung **DEST leer lassen** und **RDM** nutzen.
- Fuer kontrollierte Auswahl **PICK** aktivieren. Dann entscheidet man erst im Briefing, welcher Vorschlag wirklich ausgearbeitet wird.
- Wenn du nur ein Ziel mit Planungsbriefing willst, nutze **Freiflug/Planung** statt einer echten Mission.

### Missionstypen

Der Basic-Picker deckt die wichtigsten Faelle ab:

- **APT**: Flugplatz-zu-Flugplatz.
- **POI**: Rundflug oder Zielpunkt mit Rueckkehr-/Zielbezug.
- **Bush**: Backcountry- und Remote-Strip-Auftraege.
- **APT/POI Freiflug/Planung**: Route und Briefing ohne Missionsruntime.

Der erweiterte Picker enthaelt Spezialprofile:

- **APT**: Verein, Privat, Charter, Cargo, Training, Medizin-Transfer, fragile Fracht, Tiertransport, Reporter, Sightseeing.
- **POI**: Training, Infrastruktur-Inspektion, Ketten-Erstbefund, Foto/Film, Mapping/Survey, Reporter, Sightseeing, Lern-Guide, Historiker, Bio/Umwelt, Geo/Relief, SAR/Rescue, Fire Watch.
- **Bush**: Versorgung, Charter, Adventure, Recon Return, Pickup Return, Cargo Pickup Return.
- **Zielkategorien**: Bruecken, Strasse/Autobahn, Staudamm/Talsperre, Funkmast, Industrie, Infrastruktur, Burg/Schloss, Wasser, Berg/Tal, Stadt/Turm, Sonstige.

Tipps:

- APT-Auftraege sind meistens echte A-nach-B-Fluege. POI-Auftraege drehen sich staerker um Ziel, Blick, Ueberflug, Foto, Inspektion oder Wissen.
- Bush-Profile koennen Pickup- oder Return-Logik haben. Dafuer den Missionsentwurf akzeptieren und im Kartentisch mit Live-Tracker starten.
- Spezialprofile liefern bessere Geschichten, wenn Startregion, Distanz und Richtung nicht zu eng gesetzt sind.

### Briefing-Seiten

Ein Dispatch erzeugt mehrere Briefing-Seiten:

- **Seite 1**: Titel, Story, Payload, Fracht, Strecke, Kurs und ETE.
- **Seite 2**: Nav-Log mit Wegpunkten und Luftraumwarnungen.
- **Seite 3**: Start-Info mit AIP, METAR, Pisten, Frequenzen, Wiki-/Ortsdaten.
- **Seite 4**: Ziel-Info oder POI-Info.
- **Seite 5**: Vertical Profile, wenn das Profil aktiv ist.

Am Briefing findest du:

- **Pin**: Flug an private Pinnwand oder Crew heften.
- **DATA / Transfer**: Flugcode, MSFS-Plan Import/Export und Transferfunktionen.
- **PDF**: Briefing Pack als PDF.
- **Mission akzeptieren**: macht aus einem Entwurf eine startbare Mission.

Tipps:

- Entwuerfe erst akzeptieren, bevor du sie exportierst, pinnst oder mit der Crew teilst.
- Im Nav-Log kann der Luftraumfilter Warnungen auf deine geplante Flughoehe reduzieren.
- AIP/METAR-Links sind direkt im Briefing und im NavCom-GPS erreichbar.

### Mission fliegen

Nach dem Akzeptieren wird eine Mission fuer den Kartentisch vorbereitet. Mit Live-Tracker kann die App Start, Boarding, Cargo, Zielnaehe, Foto-/Inspektionsereignisse, Rueckkehrlogik und Ankunft besser einordnen.

Wichtige Funktionen:

- **Mission starten** erscheint im Kartentisch, wenn ein akzeptierter Auftrag bereit ist.
- **Passagier-Text und -Stimme** reagieren auf Missionsphase und Flugverhalten, wenn aktiviert.
- **Audioeffekte** koennen Boarding, Cargo, Foto oder Missionsereignisse unterstuetzen.
- **Missionsstatus** in den Einstellungen zeigt den naechsten erwarteten Schritt.

Tipps:

- Wenn eine Mission gestartet werden soll, erst Tracker verbinden und am Boden stabil stehen.
- Bei reinen Planungs-/Freiflugprofilen gibt es bewusst keinen Missionsstart.
- Der Log-/Weiterflug-Abschluss kann je nach Entwicklungsstand deaktiviert sein; gespeicherte Missionen und Flugdaten bleiben davon getrennt.

### Export, Import und Teilen

Der Transfer-Hub unter **DATA / 💾** kann:

- Flugcode kopieren und laden.
- MSFS `.pln` exportieren.
- MSFS-Plan importieren.
- Daten fuer externe oder 2D-Nutzung vorbereiten.
- PDF-Briefing erzeugen.

Tipps:

- Flugcodes sind praktisch fuer Chat, Discord oder ein zweites Geraet.
- MSFS-Export erst nach Akzeptieren nutzen, damit kein Entwurf im Plan landet.
- PDF vor dem Start erzeugen, wenn du ein klassisches Kneeboard willst.

## Teil 3: EFB, Kartentisch und Freiflug ohne Dispatch

### Kartentisch oeffnen

Der **Kartentisch** ist die grosse EFB-Ansicht. Er funktioniert mit Dispatch, mit importierten Routen und ohne Mission.

Zentrale Tasten:

- **Route Reset**: manuelle Routenanpassungen zuruecksetzen.
- **Profil**: Hoehenprofil ein- oder ausblenden.
- **Anzeige**: Layer und Overlays.
- **Audio**: Warnungen, Stimmen und Effekte.
- **Direct To**: Freiflugmodus fuer direkte Navigation.
- **Mission starten**: nur sichtbar, wenn eine echte Mission bereit ist.

Tipps:

- Im Kartentisch werden Pinnwand und andere Overlays geschlossen, damit die Karte genug Platz hat.
- Auf kleinen Displays die Toolbar einklappen und Autozoom nutzen.

### Route und Karte

Du kannst die Route direkt bearbeiten:

- Wegpunkte auf der Route anfassen und verschieben.
- Neue Punkte setzen, Punkte loeschen und Route zuruecksetzen.
- **Snapping** aktivieren, damit Punkte an Flugplaetzen, Funkfeuern oder Meldepunkten einrasten.
- **Direkt-Linie** fuer die einfache magentafarbene Orientierung ein-/ausblenden.
- **Auto-Follow** zentriert die Karte auf deiner Live-Position.

Zeichen- und Planungstools:

- Stift, Radierer, Farbe und Strichstaerke.
- Messwerkzeug fuer Distanzen und Kurse.
- Zeichnungen und Messungen loeschen.
- Stoppuhr mit Timer, UTC und Lokalzeit.
- VFR-Rechner mit Formel-Spickzettel fuer Navigation, Fuel, Sinkflug, Wind, Performance und Einheiten.
- Seitendrawer mit Checklisten und Kartenwerkzeugen.

Tipps:

- Fuer schnelle VFR-Notizen Stift + Messwerkzeug nutzen, statt die Hauptflugroute zu verbiegen.
- Die Formelhilfe im Rechner ist besonders nuetzlich fuer Windkorrektur, Sinkflug und Fuel-Reserve.

### Layer, Wetter und Live-Hinweise

Im Menue **Anzeige** findest du:

- **Wetter** mit METAR/Open-Meteo-Quelle, Windbarben und Wolkenfeldern.
- **VFR-Index** mit Land-Auswahl, Modell, Refresh und Ampel-Zeitfenster.
- **Terrain Avoid** mit Warn- und Safe-Schwellen.
- **Traffic** fuer andere Flugzeuge aus dem Simulator.
- **Autozoom** mit einstellbarer Vorausschau.
- **Telemetrie**, **Aktuell**, **Wegpunkt-Info**, **Route-Leiste**.
- **Leg-Beschriftung** fuer Distanz/Informationen.
- **Kompassscheibe**.
- **Low FPS Mode**.
- **Flugzeug-Icon** mit Farbe und Groesse.

Tipps:

- Terrain Avoid braucht entweder Live-Hoehe oder eine sinnvolle Cruise-Hoehe.
- VFR-Index und Wetter brauchen Internet. Bereits geladene Kartenausschnitte koennen trotzdem weiter sichtbar sein.
- Low FPS Mode ist fuer schwache Tablets, VR-Browser oder Remote-Desktop-Situationen gedacht.

### Vertical Profile

Das Profil zeigt die Route von der Seite:

- Terrain unter der Route oder im HDG-Ausblick.
- Luftraeume und Hoehengrenzen.
- Hindernisse wie Masten oder Windraeder.
- Wolken und Wetterbaender.
- Verkehr, wenn Live-Tracking aktiv ist.
- TOC/TOD-Logik aus Cruise ALT und V/S.

Bedienung:

- Horizontal zoomen.
- Y-Achse anpassen oder auf Auto zuruecksetzen.
- Cruise ALT und V/S direkt im Profil aendern.
- Profilhoehe per Griff veraendern.
- Bei Live-GPS kann das Profil in die Vorausschau entlang des aktuellen Headings wechseln.

Tipps:

- Vor dem Start einmal Route und Profil zusammen pruefen: Terrain, Luftraum, Wolken, Fuel.
- Im Flug ist HDG-/Vorausschau oft wichtiger als die urspruenglich geplante Route.

### Live-Tracking und Verkehr

Mit PC-Tracker sendet MSFS Live-Daten an die App:

- Position, Hoehe, Groundspeed, Vertical Speed und Heading.
- Flugspur und Route Progress.
- Andere Flugzeuge in der Naehe.
- Frequenz-/Positionshinweise, wenn bekannt.
- Auto-Follow, Autozoom und HDG-Profil.

Tipps:

- Wenn keine Live-Position erscheint, zuerst Pilot-ID/PIN und Login auf beiden Seiten vergleichen.
- Live-Tracking uebertraegt keine Bild- oder Tondaten aus dem Simulator.

### Freiflug ohne Dispatch: Direct To

**Direct To** ist fuer private Fluege ohne Missionsruntime gedacht.

Ablauf:

1. Kartentisch oeffnen.
2. **Direct To (An)** aktivieren.
3. Ziel auf der Karte oder an einem Flugplatz waehlen.
4. Bei Live-GPS startet die Route an deiner aktuellen Position. Ohne Live-GPS nutzt die App einen vorhandenen Start-/Routenpunkt.

Direct-To-/Freiflug-Briefings sind EFB-only:

- keine Mission starten,
- kein Boarding-/Cargo-Zwang,
- keine versteckte Passagier-State-Machine,
- keine Missionswiederherstellung als aktive Mission.

Tipps:

- Fuer reale "ich fliege einfach los"-Simulatorabende immer **Direct To** oder **Freiflug/Planung** nutzen.
- Wenn du doch Story, Passagier, Cargo oder Zielszene willst, einen echten Dispatch erzeugen und akzeptieren.

### Audio im Kartentisch

Das Audio-Menue steuert:

- Gesamtlautstaerke.
- Frequenzansagen.
- Terrain-Warnungen.
- Luftraum-Warnungen.
- Wegpunkt-Ansagen.
- Warning-Stimme.
- Passagier-Stimme, Textmodus, Humor, TTS-Modell, Fast Mode und Audio-Stil.

Tipps:

- Passagier-Text bleibt sichtbar, auch wenn die Stimme ausgeschaltet ist.
- Fast Mode kann TTS-Wartezeit senken, aber mehr KI-Verbrauch erzeugen.
- Fuer konzentrierten IFR-/ATC-Betrieb nur Warnungen aktiv lassen und Passagier-Audio ausschalten.

## Teil 4: Pinnwand und Gruppenfunktion

### Private Pinnwand

Die **Pinnwand** ist dein privates Hangar-Board:

- Tipps ein-/ausblenden.
- Freie Zettel anlegen.
- Zettel verschieben, bearbeiten und loeschen.
- Aktuelle Fluege aus dem Briefing anpinnen.
- Flugcodes laden.
- Gespeicherte Fluege wiederherstellen.
- Aufgezeichnete Flugrecords als Karte oder Debrief ansehen, wenn entsprechende Daten vorliegen.

Tipps:

- Private Zettel werden mit deiner Pilot-ID synchronisiert, wenn Auto-Sync aktiv ist.
- Das private Board ist gut fuer Routenideen, wiederkehrende Startplaetze, Checklistenhinweise und Lieblingsmissionen.
- Angepinnte Missionsentwuerfe koennen nicht geladen werden. Erst akzeptieren, dann pinnen.

### Crew Board

Das **Crew Board** ist die gemeinsame Pinnwand fuer eine Gruppe.

Einrichten:

1. In **Pilot Identity & Sync** mit Pilot-ID und PIN einloggen.
2. Unter **Crew Board** einen **Crew-Code** eingeben, zum Beispiel `EDTK`.
3. Optional einen Anzeigenamen setzen.
4. **Beitreten / Update** klicken.

Funktionen:

- Gemeinsame Zettel fuer alle Crew-Mitglieder.
- Fluege aus dem Briefing an die Crew heften.
- Neue Crew-Zettel werden mit Badge markiert.
- Crew-Roster zeigt Mitglieder und Status.
- Der erste Ersteller wird Admin.
- Admins koennen andere Mitglieder entfernen.
- Eigene Crew-Zettel koennen fuer alle geloescht werden; fremde Zettel werden lokal ausgeblendet.

Tipps:

- Einen kurzen, eindeutigen Crew-Code verwenden, zum Beispiel Vereinskennung oder Flugplatz.
- Vor dem Teilen eines Fluges immer pruefen, ob er akzeptiert ist.
- Crew-Board ist kein ATC- oder Multiplayer-Server. Es teilt Planung, Notizen und Auftraege, nicht die eigentliche Simulator-Session.

### Sync-Regeln fuer Pinnwand und Crew

- Private Pinnwand: gehoert zu deiner Pilot-ID.
- Crew Board: gehoert zum Crew-Code und nutzt deine Pilot-ID/PIN zur Authentifizierung.
- Auto-Sync speichert private Daten automatisch.
- Crew-Sync laeuft beim Oeffnen und nach Aenderungen.
- Gelesen-/Neu-Status wird lokal und per Cloud abgeglichen.

Tipps:

- Wenn ein Crew-Zettel nicht auftaucht, Pinnwand schliessen und erneut oeffnen oder einmal Push/Pull pruefen.
- Bei mehreren Geraeten erst klaeren, welches Geraet den aktuellsten privaten Stand hat, bevor du manuell pushst.

## Datenquellen und Grenzen

Das VFR Multitool nutzt je nach Funktion lokale Daten, Browser-Cache, Live-Tracker-Daten, OpenAIP, Wetterquellen, DWD-/VFR-Daten, Kartenkacheln, Flughafen-/POI-Daten, Wikipedia/Wikidata-Kontext und optionale KI-Provider.

Grenzen:

- Internetdaten koennen fehlen, veraltet sein oder kurzzeitig nicht antworten.
- Luftraum-, Wetter-, Terrain- und Hindernisdaten sind Simulator-/Planungshilfen, keine reale Freigabe.
- API-Keys bleiben lokal im Browser, muessen aber wie Passwoerter behandelt werden.
- Browser-Cache und Service Worker koennen alte Versionen halten; im Zweifel Update erzwingen oder Seite neu laden.
