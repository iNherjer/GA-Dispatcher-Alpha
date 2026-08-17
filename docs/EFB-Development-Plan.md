# EFB-Entwicklungsplan

Stand: 2026-08-17

Diese Datei ist der chatuebergreifende Einstiegspunkt fuer die Entwicklung der
MSFS-2024-EFB-App. Neue Chats lesen zuerst diese Datei und danach, passend zur
Aufgabe, `docs/EFB-Tracker-Architecture.md`, `docs/EFB-Community-Package.md`
und `docs/github-push-workflow.md`. Architekturentscheidungen, Releases und
wesentliche Testergebnisse werden hier fortgeschrieben.

## Aktueller freigegebener Stand

| Bereich | Alpha | Stable | Bemerkung |
| --- | --- | --- | --- |
| Web-App | `origin/main` | getrennte Stable-Promotion | Alpha muss weiterhin mit dem freigegebenen Stable-Tracker funktionieren |
| Tracker-Runtime | v358 Alpha-Kandidat | v356 | Gruppen-Szenen nur in Alpha; v358 isoliert den Debug-Helfer von der Missions-Authority, Stable bleibt unveraendert |
| EFB-Community-Package | 0.4.11 Alpha | 0.4.11 | Beide Kanaele zeigen auf dasselbe mit SDK 1.7.2 gebaute und In-Sim-getestete Archiv |
| EFB-Transport | HTTP-Loopback, read-only | - | `127.0.0.1:49880`, keine Zugangsdaten und keine schreibenden Mission Commands |

## Aktueller EFB-Kanalstand

Der aktuelle Quellstand behandelt die Werkzeugstarter fuer Uhr/Stoppuhr,
Rechner und E6B als echte Umschalter. Ein erneuter Klick auf denselben Starter
schliesst das bereits sichtbare Werkzeug sowohl im tracker-gehosteten
Kartentisch als auch in der nativen EFB-Oberflaeche. Das ist noch keine neue
Paket- oder Kanalversion; die freigegebenen Artefakte bleiben unveraendert.

Tracker v348 / Host 0.6.2 und EFB 0.4.11 wurden mit dem offiziellen
MSFS-2024-SDK 1.7.2 auf Windows gebaut, in MSFS getestet und fuer Alpha
freigegeben. Der 0.4.10/v347-Test bestaetigte zuvor Modern-
Design, Umschaltung, die breitere Mission Control, Checklisteninteraktion und
den direkten Cloudabruf. Im laufend aktualisierten Missionsmenue unterbrach
der vollstaendige DOM-Neuaufbau jedoch den Coherent-Scroll; ausserdem waren
einzelne EFB-Fallbacktexte noch ASCII-transliteriert. 0.4.11 setzt den Drawer
auf zwei Drittel der Kartenbreite, stabilisiert den Scroll bei Liveupdates und
behaelt die globale Schriftwahl von 90 bis 130 Prozent bei.

Tracker v354 / Host 0.6.3 ist als reines Tracker-Host-Update in Alpha
veroeffentlicht. Es erzwingt im EFB fuer FAA- und DWD-Rastertiles normalen
Blend-Modus und trennt VFR, offizielle Karten und Wetter in stabile Pane-
Ebenen. Das offiziell getestete EFB-Community-Paket 0.4.11 bleibt unveraendert;
ein neuer SDK-Build ist fuer diesen Test nicht erforderlich.

Tracker v356 begrenzt die Homebase-Naeherungsautomatik auf Controls ohne
explizites `proximityAutomation: false`. Die in v355 wieder sichtbar gemachten
Pavillon-Seitenwaende bleiben damit manuell pro Instanz ein-/ausblendbar, werden
aber nicht mehr wie ein Hangartor durch Spieler oder Mitarbeiter geschaltet.
Hangars und die Buerocontainertuer behalten ihr bisheriges automatisches und
manuelles Verhalten. Der Opt-out bleibt beim Merge eines aelteren installierten
Asset-Katalogs erhalten; das Homebase-Asset-Paket und EFB 0.4.11 bleiben
unveraendert.

Am 2026-08-17 wurden Tracker v356 und EFB 0.4.11 nach Stable promoviert. Beide
Stable-Kanaldateien referenzieren die bereits fuer Alpha veroeffentlichten,
unveraenderlichen Release-Artefakte mit identischer Dateigroesse und SHA-256;
es wurde kein neues Artefakt gebaut oder ein bestehendes Asset ersetzt.

Tracker v352 ist ein reiner Runtime-/Relay-Hotfix auf diesem Stand; EFB 0.4.11
und Host 0.6.2 werden nicht neu gebaut. Nach fuenf Minuten am Boden unter 5 kt
oder sofort bei MSFS-Nullposition `(0,0)`, pausierter Menueposition nahe
`(0,90)`, nach fuenf Minuten durchgehender Pause beziehungsweise bei `SimStop`
pausieren nur die
2-Hz-GPS-/Traffic-Pakete zu Cloudflare und Render. SimConnect, lokaler EFB-
Snapshot, Commands und ACKs bleiben aktiv. Der 5-Sekunden-Status meldet
`telemetryMode=hibernate` samt Grund, die Web-App zeigt `HIB · v352 C/R`, und
Flugzustand oder mindestens 5 kt wecken die Telemetrie ohne Neustart. Die
isolierte Zustandslogik und der Loopback-Vertrag sind automatisiert getestet;
der reale MSFS-Uebergang bleibt vor einer Stable-Promotion zu bestaetigen.

v350 fuegt additiv `telemetry.wake.v1` hinzu. Tracker-Commands fuer Mission,
Route/Authority-Snapshot, Cargo/Payload, Szenen und Homebase bleiben im HIB
empfangsbereit, wecken die Relay-Telemetrie vor der Sim-Aktion und setzen
Boden- sowie Pause-Timer gemeinsam zurueck. Oeffnet die Web-App eine bereits
hibernierende Boden-/Pause-Session, uebernimmt sie die letzte gueltige Position
aus dem 5-Sekunden-Status und fordert genau einmal frische Telemetrie an. Die
unbrauchbaren Menue-/Nullpositionen `(0,90)` und `(0,0)` sowie SimStop bleiben
nicht weckbar. Das Ende einer HIB-Regel setzt beide Timer zurueck, damit etwa
das Aufheben der Pause nicht durch den parallel abgelaufenen Bodentimer sofort
wieder in HIB fuehrt. Web-Cache `ga-dispatcher-v1635` enthaelt den passenden
App-Vertrag.

v351 korrigiert die im realen v350-Bodentest gefundene Homebase-
Rueckkopplung. Der 45-Sekunden-Gruppenpoll behaelt seine letzte
Crew-Szenensignatur und sendet `homebase_v1.crew.set` nur noch bei einer
tatsaechlich geaenderten Szene. Der Tracker vergleicht denselben Befehl
zusaetzlich mit der erfolgreich aufgebauten Crew-Szene: identische
Wiederholungen erhalten `status=noop`, bauen keine SimObjects neu auf und
setzen weder Boden- noch Pause-HIB-Timer zurueck. Eine echte Aenderung bleibt
ein Sim-relevanter Command und weckt weiterhin vor ihrer Ausfuehrung. Der
zugehoerige Web-Cache ist `ga-dispatcher-v1636`.

v352 schliesst die im anschliessenden realen HIB-Test gefundenen Wake- und
Darstellungsluecken. Die Web-App zeichnet die im Status weitergefuehrte letzte
gueltige Position auch dann als gekennzeichneten HIB-Marker, wenn der
Kartentisch erst nach dem letzten 2-Hz-Paket geoeffnet oder neu aufgebaut wird.
Vertrauenswuerdige Nutzerinteraktionen wie Kartentisch oeffnen/schliessen,
Klick, Touch, Tastatur, Scrollen oder das Ende einer Drag-Aktion fordern bei
Boden-/Pause-HIB einen Wake an; die gesperrten Menue-/Nullpositionen bleiben
unveraendert nicht weckbar. Die Routensignatur erfasst nun auch kleine
Geometrie-, Namen-, Hoehen- und POI-Aenderungen sowie das Leeren einer Route,
damit der bestehende Authority-/Wake-Pfad nicht ausfaellt.

Auf Trackerseite werden `Pause`, `Pause_EX1`, `SimStart`, `PositionChanged` und
`FlightLoaded` als echte Zustandswechsel behandelt. Ein aufgehobenes
Pause-Signal sowie neue Flug-/Positionszustaende wecken den Controller und
setzen beide HIB-Timer zurueck. SimConnect-Pausevariablen sind nach einer
kurzen Ereignis-Uebergangsfrist autoritativ, sodass ein nicht zurueckgesetztes
Event-Flag den Tracker nicht dauerhaft im Grund `paused` halten kann. Der
zugehoerige Web-Cache ist `ga-dispatcher-v1637`.

v353 ist als Alpha zusammen mit Desktop 1.6.1 veroeffentlicht und trennt den
sichtbaren Betriebszustand vom Relay-Transport. Das Desktop-
Fenster zeigt `LIVE`, `HIB`, `LINK` oder `OFF` und weist die tatsaechlich
verbundenen Relay-Wege als `C+R`, `C` beziehungsweise `R` aus. Kurze
WebSocket-Neuverbindungen und geplanter App-Netzwerkschlaf werden in der
Web-App nicht mehr faelschlich als abgeschalteter Tracker dargestellt; ein
bekannter HIB-Zustand bleibt bis zum Wake sichtbar. Die abgearbeitete normale
Homebase-Tordiagnose schreibt keine wiederholten Open-/Close-/Scan-Zeilen mehr,
Fehler bleiben weiterhin protokolliert. Der veroeffentlichte Web-Cache ist
`ga-dispatcher-v1639`.

Eigene App-Checklisten werden nach Aushandlung von `checklist.library.v1`
begrenzt und sanitisiert an den Tracker uebergeben. Zusaetzlich liest Tracker
mit Pilot-ID/PIN die bereits von der App im bestehenden GA-Sync
gespeicherten `CHKIDX_`-/`CHK_`-Datensaetze beim Start und alle 60 Sekunden
selbst. Nur ein vollstaendig gueltiger Abruf ersetzt den atomaren lokalen Cache
`efb-checklists-v1.json`; bei Netz- oder Serverfehlern bleibt der letzte Stand
erhalten. `GET /api/v1/checklists` stellt ihn lokal fuer das EFB bereit. Der
Abhakfortschritt bleibt weiter ausschliesslich im EFB-localStorage und wird
nicht an App, Tracker oder Cloud zurueckgeschrieben.

v353 behebt dabei den im realen Log nachgewiesenen Konflikt zwischen drei
lokalen und zwei im Cloud-Index eingetragenen Listen. Identischer Inhalt ist
weiterhin ein echtes `noop` ohne Persistenz oder Revisionswechsel und wird nun
auch so protokolliert. Sobald der Tracker in einer Sitzung einen gueltigen,
vollstaendigen App-Snapshot akzeptiert hat, bleibt dieser Snapshot autoritativ;
ein bereits laufender oder spaeterer Cloud-Fallback darf ihn nicht wieder durch
einen unvollstaendigen Index ersetzen. Die Web-App zieht beim Start zunaechst
vorhandene Remote-Listen und ergaenzt danach nur fehlende oder lokal neuere
Eintraege samt Index. Fehlgeschlagene Remote-Abrufe werden nicht
ueberschrieben; explizite Loeschungen behalten den bestehenden Indexpfad.

Mission Control erhaelt ueber `mission.view.v1` eine begrenzte Projektion der
bereits in der App dargestellten Missionsdaten aus demselben Authority-Resume-
Bundle. Es zeigt Auftrag, Verlauf, Ziel, Live-Flugwerte, Fortschritt,
Bedingungen, Passagier-/Ladungszustand und Lagebericht, bleibt jedoch read-only.
Der v348-Renderer trennt volatile Revisionen, Zeitstempel, Zielentfernung und
Live-Flugwerte von strukturellen Missionsaenderungen. Livewerte werden gezielt
aktualisiert; echte Inhaltsaenderungen werden waehrend Touch-, Wheel- oder
Momentum-Scroll gepuffert und danach mit wiederhergestellter Position
angewendet. Der UTF-8-Vertrag bleibt unveraendert; sichtbare EFB-Fallbacktexte
verwenden echte Umlaute, einschliesslich normalisierter kombinierender
Umlautzeichen. Die veroeffentlichten GitHub-Artefakte wurden nach dem Upload
frisch heruntergeladen und gegen Groesse, SHA-256 und Paketversion geprueft.

EFB 0.4.1 zeigt Trackerstatus, Flugtelemetrie, Route, Flugzeugposition,
Planprofil und lokale Werkzeuge ueber Tracker v326 und `map.snapshot.v1`.
Der In-Sim-Test bestaetigt aktive Route, korrekt gesetztes Flugzeug und
bedienbare Werkzeuge; Gestaltung und Werkzeugdarstellung erreichen den
Original-Kartentisch noch nicht. Missionsbriefing, Manifest und schreibende
Missionsaktionen sind weiterhin nicht Bestandteil dieses Protokollstands.

Der Quellstand von 0.4.1 ist lokal mit dem annotierten Git-Tag
`efb-v0.4.1-sdk-input` unveraenderlich markiert. 0.4.2 entsteht getrennt im
Branch `codex/efb-map-server-0.4.2`; weder der laufende Windows-SDK-Build von
0.4.1 noch der Alpha-Kanal werden dadurch veraendert. Die Tracker-Webclient-
Probe ist als separater Diagnosepfad erhalten. Nach dem positiven 0.4.1-
Fallbacktest entsteht in 0.4.2 additiv der erste echte tracker-gehostete
Kartentisch-View.

EFB 0.4.0 wurde mit dem offiziellen SDK 1.7.2 gebaut, nach dem In-Sim-Test aber
verworfen. Menueleiste, Designs und Werkzeuge hatten weder die optische noch
die funktionale Naehe zum Web-Kartentisch. Im Coherent-Host wurde der
Query-Schalter des E6B-Iframes nicht zuverlaessig als Embedded-Modus erkannt;
dadurch erschien die Entwicklungsmaske, waehrend die eigentlichen Scheiben
ausserhalb der sichtbaren Flaeche lagen beziehungsweise nicht geladen waren.
Mehrere moderne CSS-Kurzformen und Unicode-Piktogramme fuehrten zusaetzlich zu
verworfenem Layout und nicht darstellbaren Zeichen. 0.4.1 ersetzt diesen
Ansatz durch Kartentisch-nahe Toolbar- und Werkzeugkomponenten, ASCII-sichere
Bedienelemente, explizite Coherent-Geometrie sowie den echten interaktiven E6B
mit lokal vorgebuendelten Front- und Windscheiben.

EFB 0.3.0 wurde mit SDK 1.7.2 erfolgreich gebaut, im In-Sim-Test aber
verworfen: Header und Trackerstatus erschienen, die komplette Kartenflaeche
einschliesslich ihrer Bedienelemente blieb schwarz. Der Tilezugriff war dabei
extern erfolgreich; das Fehlerbild liegt vor der Tile-Darstellung. EFB 0.3.1
belegte auf einem System mit funktionierender 3D-Ausgabe, dass App, View-Switch
und Tracker-Poll weiterlaufen. Karten- und Statusflaeche blieben dennoch
unsichtbar. EFB 0.3.2 ersetzte deshalb die fuer Coherent verdaechtige
`inset`-Kurzform durch explizite Vollflaechen-Geometrie und startet Leaflet nur
bei messbarer Hostgroesse. Dadurch sind Karte, Flugzeugmarker und Zoom im
Simulator sichtbar und funktionsfaehig; die ueber Leaflet liegenden
Layer-/Follow-Bedienelemente nehmen jedoch noch keine Eingaben an. EFB 0.3.3
trennt diese Bedienelemente deshalb in eine eigene Pointer-Overlay-Ebene. Der
In-Sim-Test zeigt dort weiterhin: Leaflet-Zoom funktioniert, alle app-eigenen
Buttons bleiben ohne Wirkung. Die Analyse der mit SDK 1.7.2 ausgelieferten
`FSComponent`-Implementierung ergab, dass native JSX-`onClick`-Props nicht als
Listener registriert, sondern nur als HTML-Attribute gesetzt werden. EFB 0.3.4
bindet deshalb alle eigenen Buttons nach `onAfterRender` direkt ueber
`HTMLButtonElement.onclick`. Der In-Sim-Test von 0.3.4 bestaetigt Karte/Status,
Layerdialog, Layerauswahl und Follow als bedienbar. Dabei wurden drei
Darstellungsdetails fuer 0.3.5 festgelegt: 50 Prozent Basiskarten-Deckkraft bei
aktivem Aero-Overlay wie im Web-Kartentisch, dessen gelber 40-px-Flugzeugmarker
und eine rein darstellende Entprellung kurzzeitig leerer Missionssnapshots.
Bis zur Freigabe bleibt der Alpha-Kanal auf 0.2.0; es gibt keine automatische
Vorabinstallation des Karten-Prototyps.

## Verbindliche Architekturentscheidungen

1. Der Windows-Tracker wird schrittweise zur lokalen Ausfuehrungs- und
   Rechenebene. SimConnect, Telemetrie, Szenen, persistente Missionslaufzeit und
   spaeter die Missionsausfuehrung liegen dort.
2. Das EFB bleibt eine schlanke Darstellung und sendet Benutzerabsichten. Es
   setzt niemals direkt Missionsphasen oder SimConnect-Werte.
3. Die Web-App bleibt fuer Missionserzeugung, V4-Semantik, Briefing, Contract,
   Profil und Cloud-Daten verantwortlich. Sie bleibt waehrend der Migration die
   Stable-Referenz.
4. Missionsregeln werden nicht aus Browserdateien in `tracker.js` kopiert. Sie
   werden zuerst als transport-, UI- und persistenzneutraler Kern extrahiert,
   den Web und Tracker mit denselben Tests ausfuehren koennen.
5. Pro Missionslauf gibt es genau eine schreibende Autoritaet. Web und Tracker
   duerfen nie gleichzeitig nach Last-write-wins denselben Zustand veraendern.
6. Neue Funktionen sind additiv und werden ueber Capabilities ausgehandelt.
   Fehlt eine Capability, bleibt die Web-App Autoritaet und das EFB zeigt einen
   begrenzten, erklaerten Fallback.
7. Alpha und Stable verwenden unveraenderliche Release-Artefakte. Ein getestetes
   Alpha-Artefakt wird durch Kanalumschaltung nach Stable promotet und nicht neu
   gebaut.

## Zielbild und Datenfluss

```text
Web-App: Missionserzeugung, Semantik, Briefing, Profil
                 |
                 | versioniertes Mission Execution Bundle
                 v
Tracker: autoritativer Missionskern, Persistenz, Telemetrie, Szenen
          |                                      ^
          | Snapshots                            | validierte Intents
          v                                      |
                 MSFS-2024-EFB

Web-App <---- Snapshots/Ereignisse ----> Tracker
           Beobachter/Fallback waehrend der Migration
```

Der Missionskern entscheidet aus einem alten Zustand und einem expliziten
Ereignis deterministisch den neuen Zustand. UI, Voice, Szenen und Transport
reagieren auf ausgegebene Effekte, besitzen aber keine versteckte eigene
State-Machine.

## Produktziel: Kartentisch im EFB

Der Kartentisch mit seinen flugrelevanten Werkzeugen ist das zentrale
Produktziel der EFB-App. Hauptmenue und Pinnwand muessen nicht ins EFB
uebernommen werden. Das EFB soll langfristig die cockpitgerechte Karten- und
Missionsoberflaeche sein, waehrend die Web-App fuer Missionsauswahl, Planung und
umfangreiche Verwaltung verfuegbar bleibt.

Der bestehende `map.js`-Kartentisch wird nicht als Ganzes in die EFB-App
kopiert. Er ist stark an DOM, globale Web-App-Zustaende, `localStorage`,
Missionsruntime und externe Datenquellen gekoppelt. Wiederverwendbare Geometrie,
Klassifikation und Darstellungskonfiguration werden schrittweise in reine
Module extrahiert. Web-Kartentisch und EFB erhalten getrennte, fuer ihre
Oberflaeche passende Renderer auf denselben Vertraegen.

### Geplante Kartenfunktionen

- Flugzeugposition, Kurs, Track, Hoehe, Geschwindigkeit und Auto-Follow
- aktuelle Route, Legs, Wegpunkte, Direktlinie und Fortschritt
- Missionsziele, Suchgebiete, Survey-Muster, Korridore und Szenenhinweise
- Basiskarten und ausgewaehlte Luftfahrt-Overlays
- Flugplaetze, Navaids, Luftraeume, AIP-Verweise und relevante Detailkarten
- Wetter, Wind, Radar, VFR-Index und spaeter Terrain-Avoid
- Messen, Zeichnen, Markierungen und touchgerechte Kartenwerkzeuge
- Hoehenprofil, Leg-Informationen und kompakte Flug-/Missionsstatusanzeige
- optionale Cockpitwerkzeuge wie Stoppuhr, Rechner und E6B

### Karten-Verantwortungsgrenzen

- Das EFB rendert Karte, Marker und lokale UI-Zustaende wie Zoom, Follow,
  Layerauswahl, Messung und nicht missionskritische Zeichnungen.
- Der Tracker liefert hochfrequente Flug- und Traffic-Daten, Route,
  Missionsgeometrie, abgeleitete Warnungen und spaeter gecachte Datenprodukte.
- Web-App beziehungsweise Worker bleiben zunaechst Quelle fuer Planung,
  Wetter-, AIP-, OpenAIP-, GAFOR- und Hindernisdaten. Der Tracker stellt diese
  schrittweise ueber kontrollierte lokale Endpunkte bereit, damit das EFB nicht
  von vielen externen CORS-/CSP- und Authentifizierungswegen abhaengt.
- Externe Karten- und Overlayquellen werden vor Uebernahme einzeln auf
  Nutzungslizenz, Attribution, CORS, Canvas-Kompatibilitaet und Cache-Regeln
  geprueft. Kartenkacheln werden nicht ungeprueft gespiegelt oder offline
  gespeichert.

### Karten-Ausbaustufen

1. `K0 Map Shell`: lokal gebuendeltes Leaflet, eine Basiskarte, Flugzeugmarker,
   Pan/Zoom, Auto-Follow und robuste Touch-/Orientation-Tests.
2. `K1 Flight Map`: Route, Legs, Wegpunkte, Fortschritt, Direktlinie, Messen und
   grundlegende Flugdatentafeln.
3. `K2 Mission Map`: Missionsziele und -geometrie aus `mission.snapshot.v2`
   beziehungsweise einem getrennten `map.snapshot.v1`; weiterhin read-only.
4. `K3 Aviation Layers`: Flugplaetze, Navaids, Luftraeume, Wetter und
   AIP-Verweise ueber klar versionierte Datenadapter.
5. `K4 Advanced Tools`: Zeichnen, Hoehenprofil, Traffic, VFR-Index,
   Terrain-Avoid und weitere rechenintensive Layer nach Performance- und
   Quellenpruefung.

Ein erster Karten-Prototyp benoetigt noch keine Tracker-Autoritaet ueber den
Missionskern. `flight.snapshot.v1` reicht fuer `K0`; Mission Snapshot v2 und der
spaetere Missionskern erweitern dieselbe Karte danach um Missionsinhalt und
validierte Aktionen.

Fuer den 0.3.0-Prototyp sind die beschriftete OpenTopoMap und das
VFR-/Aero-Overlay als Default festgelegt. Alternative Basiskarten sowie DFS-,
FAA- und DWD-Overlays sind opt-in und werden erst nach Auswahl angefordert. Bei
direkten Online-Tile-Anfragen sehen die jeweiligen Anbieter technisch bedingt
IP-Adresse, Zeitpunkt, Zoomstufe und Kachelkoordinaten, jedoch keine Pilot-,
Missions- oder Tracker-Zugangsdaten. Die Auswahl bleibt lokal gespeichert; ein
eigener Offline-Cache ist nicht Teil von K0.

Source-Kandidat 0.4.1 kombiniert die ersten read-only Teile von K1, K2 und K4:
Tracker v326 projiziert aus dem persistenten Resume-Bundle Route, Wegpunkte,
aktives Leg, Restdistanz, Cross-Track, Missionsziel/POI-Kette und ein
planbasiertes Hoehenprofil in `ga.map-snapshot.v1`. Der Snapshot enthaelt keine
Story-, Passenger-, Cloud- oder Zugangsdaten. Das EFB rendert diese Projektion
mit eigenem Leaflet-/SVG-Renderer. Classic, Retro, NAV/COM, OPS 1940 und
Windows 95 sind lokale EFB-Designs; Menueleiste und Hoehenband werden lokal
persistiert. Uhr/Stoppuhr und Rechner laufen rein lokal. Der bestehende E6B
wird nicht als vereinfachte Maske nachgebaut: Front- und Windscheibe sowie die
vorhandene Drag-, Dreh-, Flip- und Zoom-Logik werden als lokale Assets
gebuendelt. Ein volles Terrainprofil bleibt K4: 0.4.1 kennzeichnet sein
Hoehenband explizit als Planprofil und erfindet keine
fehlenden Terrainpunkte.

Source-Kandidat 0.4.2 verwendet eine zweite Hostgrenze. Tracker v327 liefert
hinter `efb.web-client.v1` eine dedizierte read-only Seite unter `/efb/v1/`;
die kleine Transportprobe bleibt unter `/efb/v1/probe/` erreichbar. Der echte
View extrahiert den originalen Kartentisch-DOM aus `index.html`, verwendet die
originale `styles.css`, `map-utility-tools.js`, Leaflet- und E6B-Assets und
fuellt die Oberflaeche ueber einen kleinen Tracker-Hostadapter. `map.js` und
`profile.js` werden wegen ihrer Kopplung an Cloud, Missionsruntime und globale
Web-App-Zustaende nicht als Ganzes geladen. Route, Missionsgeometrie,
Navigation und Planprofil kommen weiter ausschliesslich aus
`map.snapshot.v1`; Missionen bleiben read-only. Das EFB zeigt die `App-Karte`
nur bei ausgehandelter Capability, ohne v327 bleibt die native 0.4.1-Karte
vollstaendig aktiv.

Der lokale Browser-Gate vom 2026-08-11 bestaetigt Original-Styles, Route,
Flugzeugmarker, Kompass, Planprofil, Designs, Toolbar, Layer und die originalen
Werkzeuge. Stoppuhr, Rechner (`7 + 8 = 15`) und der echte E6B inklusive Flip
auf die Windscheibe liefen ohne Scriptfehler. Tracker v327 und EFB 0.4.2 wurden
danach auf Windows gebaut und durchs offizielle SDK geschickt. Der Coherent-
In-Sim-Test lud zwar das originale HTML/CSS-Grundgeruest, initialisierte aber
die externe JavaScript-Kette nicht: Karteninhalt und Hostanpassungen fehlten,
waehrend `/efb/v1/assets/host.js` am laufenden Tracker mit HTTP 200 erreichbar
blieb. Der originale Schliessen-Handler konnte in diesem Zustand zudem eine
noch nicht definierte Hostfunktion aufrufen.

0.4.3/v328 ist der isolierte Diagnose- und Haertungskandidat. Ein kleiner
Inline-Bootstrap stellt den Schliessen-Pfad bereits vor allen externen
Skripten bereit, laedt Leaflet, Map-Kern, Werkzeuge und Hostadapter danach
explizit in Reihenfolge und meldet Bootstufen sowie Fehler an den begrenzten
Loopback-Endpunkt `/api/v1/client-log`. Ein zufaelliger iframe-Channel ergaenzt
die Parent-Pruefung, weil Coherent `MessageEvent.source` nicht in jeder
Konstellation verlaesslich erhaelt. Diese Diagnosedaten sind nicht
missionsautorativ und koennen weder SimConnect noch Missionszustand aendern.

Der In-Sim-Log von 0.4.3 hat die Transport- und Reihenfolgefrage geklaert:
alle Assets wurden mit HTTP 200 geladen und der Inline-Bootstrap sowie der
Schliessen-Channel liefen. Coherent verwarf jedoch `map-shell-core.js` an
Optional Chaining (`?.`) und `map-utility-tools.js` an Object Spread (`...`).
Der anschliessende Hostfehler an `API.normalizePreferences` war nur eine Folge
des nicht angelegten Map-Kerns. 0.4.4/v329 entfernt Optional Chaining,
Nullish Coalescing und Spread aus der gesamten ausgelieferten Map-/Werkzeug-/
E6B-Skriptkette, installiert kleine Runtime-Polyfills und beantwortet die nur
durch geerbte App-CSS angefragten `bg.jpg`/`map.jpg` lokal mit einem
transparenten Platzhalter.

Der In-Sim-Test von 0.4.4/v329 bestaetigt anschliessend den vollstaendigen
Hoststart, Karte, Flugzeug, Route, Toolbar und Trackerstatus. Die rotierende
Logdatei reduzierte eine vorhandene 353-MB-Datei beim Start wie vorgesehen.
Die Interaktion legte aber zwei weitere Coherent-Laufzeitluecken offen:
`String.trimEnd()` brach den Rechner ab und `Array.flatMap()` stoppte den E6B
noch vor dem Abruf seiner Scheiben-JSONs. Freihandzeichnen war im schlanken
Hostadapter noch nicht implementiert. Zudem meldeten Child und Parent den
unveraenderten Livezustand jede Sekunde und Route sowie Flugzeugmarker wurden
haeufiger als erforderlich neu gesetzt.

Tracker v330 liefert deshalb den tracker-gehosteten Kartentischstand 0.4.5
ohne neues Community-Package. Der Bootstrap und der getrennte E6B-iframe
erhalten die fehlenden Methoden; E6B-Fehler werden ueber den begrenzten
Diagnosepfad sichtbar. Rechner, Stoppuhr, E6B-Flip und Freihandzeichnen sind
im lokalen End-to-End-Browsertest bedienbar. Parent-Status wird nur noch bei
Zustandswechseln gesendet, Route nur bei veraenderter Geometrie neu aufgebaut
und der Flugzeugmarker nur bei tatsaechlicher Bewegung beziehungsweise
Headingaenderung aktualisiert.

Tracker v331 liefert den tracker-gehosteten Kartentischstand 0.4.6 ebenfalls
ohne neues Community-Package. Die Web-App legt ein optionales, auf 96 Punkte
begrenztes `mapProfile` getrennt vom Cloud-Missionspayload in das autoritative
Tracker-Resume-Bundle. Damit kann `/api/v1/map` das echte Terrainprofil samt
Planhoehe an das EFB projizieren. Die Leg-Pfeile schalten eine lokale
Wegpunktvorschau mit Distanz, Bearing und gestrichelter Vorschauverbindung;
sie veraendern weder Mission noch Route. Telemetrie-, Positions- und
Legfenster sind verschiebbar, einzeln schliessbar und ueber `Infos`
wiederherstellbar. Feste Leaflet-Panes, abgeschaltete Tile-/Zoom-Fades und
zustandsabhaengige Updates verhindern konkurrierende Layer-Reihenfolgen.

Tracker v332 liefert Hoststand 0.4.7. Die Basis bleibt beim spaeter eintreffenden
Aero-Layer voll sichtbar, statt durch zwei hintereinander angewendete
Opacity-Stufen fast zu verschwinden. Zeichenkoordinaten werden zwischen dem
tatsaechlich gerenderten Coherent-Rechteck und Leaflets interner
Containergroesse skaliert. Das E6B erhaelt im Parent eine eigene transparente
Drehflaeche und sendet Rotationsdeltas an das iframe; dadurch ist die Scheibe
auch dann bedienbar, wenn Coherent Pointer nicht zuverlaessig durch das iframe
reicht. Der Schliessen-Knopf des Legfensters ueberdeckt die Vor-/Zurueck-Pfeile
nicht mehr. Die Kopfleiste ergaenzt Anzeige, Mission, Checklisten, Layer und
Werkzeuge; das Seitenmenue zeigt den read-only Tracker-Missionsstatus sowie
lokal gespeicherte EFB-Checklisten. Ein begrenzter `map-profile`-Logeintrag
unterscheidet echtes Tracker-Terrain klar vom Planfallback.

Der v332-In-Sim-Test zeigt zwei verbleibende Transportfehler: Coherent verliert
nach einer Kartenbewegung die direkt bei externen Tile-Hosts angeforderten
Basiskacheln, waehrend lokale Route und Aero-Geometrie stehen bleiben. Ausserdem
wurde ein schon ohne `mapProfile` gespeicherter Authority-Run nach dem
asynchronen Terrainabruf der Web-App nicht erneut zum Tracker geschrieben.
Tracker v333/Host 0.4.8 leitet die fest erlaubten Basis-, Aero- und DFS-Kacheln
des Kartentisches deshalb ueber den Loopback-Server und einen auf 32 MiB
begrenzten RAM-Cache. Die Web-App stoesst nach ihrem ohnehin stattfindenden
Terrainabruf sofort ein Authority-Snapshot-Update an. Es entsteht weder ein
neuer Worker-Aufruf noch ein weiterer Terrain-Drittanbieterpfad im Tracker.

Der v334-In-Sim-Test bestaetigt zwar erfolgreiche Tile-Antworten des lokalen
Proxys, die Loopback-Bilder bleiben im Coherent-Kartentisch aber schwarz. Die
parallel getestete native EFB-Karte rendert dieselben Quellen ueber direkte
HTTPS-URLs. Tracker v335/Host 0.5.0 verwendet deshalb diesen bestaetigten Pfad
zuerst und behaelt Backup-URL sowie begrenzten Tracker-Proxy pro Kachel als
Fallback. Ein einmaliges `map-tile`-Diagnoseereignis nennt die tatsaechlich
sichtbare Quelle. Der lokale Entwicklungsserver deaktiviert Service Worker
und App-Caches auf Localhost/privaten LAN-Adressen; damit kann ein alter Stand
wie `v1603` nicht mehr unbemerkt gegen eine aktuelle Alpha-App schreiben.

Der v335-In-Sim-Test bestaetigt den direkten Tilepfad und damit eine dauerhaft
sichtbare Karte. Das fehlende Terrainband stammt nicht aus der EFB-Projektion:
die getestete Alpha `ga-dispatcher-v1619` enthaelt den spaeten Authority-
Profilpush noch nicht und lieferte laut Log nur `planned-only`. Tracker
v336/Host 0.5.1 dimmt bei aktivem Aero-Layer die Basiskarte wie der originale
Kartentisch (Basis 0,5, Aero 0,65). Der Webstand v1621 schreibt nach
Missionsstart jede tatsaechliche Routenmutation sofort in den bestehenden
Authority-Snapshot, verwirft dabei ein veraltetes Profil und sendet nach dem
asynchronen Terrainabruf denselben Snapshot erneut mit Hoehenpunkten. Der
Tracker protokolliert jeden relevanten Wechsel als `MISSION_MAP_AUTHORITY`.

Der v336-In-Sim-Test bestaetigt sichtbare Kartenkacheln, aktive Route und das
Tracker-Terrainprofil. Routenmutationen kamen jedoch erst mit dem naechsten
10-Sekunden-Runtime-Snapshot an; der Coherent-Renderer liess dabei Teile der
alten Vektorroute stehen. E6B-Drehgesten erzeugten keine `e6b-action`-Events,
waehrend normale Buttons funktionierten, und Checkbox-`change` wurde ebenfalls
nicht verlaesslich ausgeloest. Tracker v337/Host 0.5.2 sendet deshalb nach einer
Routenmutation einen kurzen Settle-Snapshot, ersetzt Route/Geometrie/Preview als
neue Leaflet-Gruppen mit separaten SVG-Renderern, akzeptiert am E6B zusaetzlich
Mouse-/Touch-Gesten und schaltet Checklistenpunkte ueber einen expliziten
Click-Pfad. Nicht darstellbare E6B-Symbole wurden durch ASCII-Beschriftungen
ersetzt.

Tracker v338/Host 0.5.3 transportiert zusaetzlich ein begrenztes Profilpaket
mit hoechstens 96 Terrainpunkten, 64 Hindernissen und 48 Luftraeumen ueber den
bestehenden Authority-Snapshot. Der Tracker normalisiert diese Daten und stellt
sie dem EFB ausschliesslich lokal ueber `127.0.0.1` bereit. Der EFB-Kartentisch
rendert daraus Profil-Luftraeume und Hindernisse, zeigt Positions- und
Frequenzkontext, bietet `Was ist hier?`, bedienbare Profilregler und einen
vertikalen Profilgriff. Die E6B-Windseite leitet nun auch Schieber- und
Windpunktgesten an den eingebetteten Originalrechner weiter. Der Zeichenpfad
nutzt Leaflets echte Containerkoordinaten und einen eigenen SVG-Renderer.
Der dynamische HDG-Profilmodus bleibt eine spaetere lokale Tracker/EFB-Aufgabe;
v338 uebertraegt weiterhin das Routenprofil und keinen sekundenweisen
HDG-Komplettsnapshot durchs Relay.

Tracker v339/Host 0.5.4 trennt die Coherent-spezifische E6B-Bedienung wieder
streng von den gemeinsam genutzten App-Dateien. Die normale Local-/Alpha-App
verwendet damit unveraendert den Original-E6B und die Original-Profilbuttons;
nur die im Tracker eingebettete EFB-Kopie enthaelt Mouse-/Touch-Hilfen fuer
Windschieber und Windpunkt. Die EFB-Kopfleiste fasst Anzeige, Mission und
Werkzeuge in Klappmenues zusammen. Ein 650-ms-Langdruck auf die Karte oeffnet
einen erweiterten lokalen Kontext mit Hoehenband, Routenpunkt, Terrain,
Frequenz und den im Snapshot vorhandenen Luftraeumen. Hindernisse werden nach
Typ als Windrad, Strommast oder Mast/Turm gerendert. Vollstaendige
Original-Paritaet fuer AIP, METAR und spontane POI-Abfragen benoetigt spaeter
einen lokalen On-demand-Kontextvertrag mit dem Tracker.

Der erste Local-Test von v339 zeigte, dass die Trennung noch nicht vollstaendig
war: E6B-HTML und -CSS wurden weiterhin gemeinsam synchronisiert und die
normale E6B-Runtime meldete `localControls: false`. Dadurch waren in Local das
Original- und das Coherent-Ersatzset gleichzeitig sichtbar; das innere Set
wirkte beim Verschieben nicht fest am Instrument. Tracker v340/Host 0.5.5
stellt die normalen E6B-HTML-/CSS-/JS- und Werkzeugdateien exakt auf den
unveraenderten Alpha-Stand zurueck. HTML, CSS, Runtime-JS und Werkzeug-JS des
EFB sind nun vier ausdruecklich geschuetzte Forks. Der Asset-Sync bricht ab,
wenn einer dieser Forks fehlt, und die App verwendet wieder nur ihr eigenes,
am Instrument verankertes Buttonset.

Der anschliessende Local-Test zeigte ausserdem eine aeltere feste E6B-
Arbeitsflaeche: Das eingebettete Instrument lief in einem auf `320%` der
Panelgroesse begrenzten Iframe und konnte auf breiten Bildschirmen deshalb
nicht bis an die sichtbaren Kartentischraender geschoben werden. Webstand
`ga-dispatcher-v1626` passt den normalen App-Iframe beim Oeffnen, Skalieren und
bei Viewport-Aenderungen an den tatsaechlich sichtbaren Browser-Viewport an.
Die Instrumentgroesse bleibt unveraendert; nur sein Bewegungsraum folgt nun
der realen Fensterbreite und -hoehe. Der geschuetzte Coherent-/EFB-Fork bleibt
davon unberuehrt.

Der anschliessende In-Sim-Test zeigte, dass der 650-ms-Karten-Langdruck im
Coherent-EFB nicht ausloest. Der Host hatte diesen Pfad ausschliesslich an
`pointer*`-Events gebunden, obwohl der Simulator bei bereits reparierten
EFB-Eingaben je nach Oberflaeche `mouse*`- oder `touch*`-Events liefert. Der
EFB-Host normalisiert deshalb nun alle drei Eingabefamilien, liest
Touch-Koordinaten auch aus `touches` beziehungsweise `changedTouches` und
beendet die Geste ueber Window-Listener. Synthetische Doppelereignisse werden
entprellt. Diese Aenderung betrifft nur
`ga-tracker-client/tracker-efb-kartentisch-host.js`; normale App-Dateien und
ihre Eingabepfade bleiben unveraendert.

Der In-Sim-Test von v341 bestaetigte danach den Karten-Langdruck, deckte aber
den fachlich falschen Platzhalterpfad auf: Koordinaten und Popup-Anker kamen
vom gedrueckten Punkt, waehrend Terrain, Luftraum und Objektkarte weiterhin
vom naechsten Routenprofilpunkt beziehungsweise Wegpunkt stammten. Host
0.5.7/v342 ersetzt diese Naeherung durch den additiven, read-only
Loopback-Vertrag `map.context.v1` unter `/api/v1/map-context`. Der Tracker
fragt fuer die explizit gedrueckten Koordinaten OpenAIP ueber den vorhandenen
GA-Proxy sowie Open-Meteo Elevation und Forecast ab, begrenzt Radius,
Antwortgroesse, Timeout und RAM-Cache und liefert Teilresultate bei
Quellenfehlern. Der Benutzer hat die dafuer notwendige Weitergabe der
gedrueckten Koordinaten am 2026-08-12 ausdruecklich freigegeben.

Das EFB zeigt daraus das tatsaechliche Gelaende, eigene Hoehe, die am Punkt
enthaltenen Luftraeume samt Grenzen/Frequenzen, Punktwetter und nur ein im
aktuellen Kartenmassstab nahes Luftfahrtobjekt. Routenwegpunkte werden nicht
mehr als Ortsinhalt eingesetzt. Hoehenband, Wolken-/Niederschlagshinweis,
Luftraumkarten, Wetterkarte und Windrose orientieren sich staerker am
Original-Kontextmenue der App. Normale App-Dateien bleiben unveraendert.

Der folgende In-Sim-Vergleich von v342 bestaetigte die korrekte Ortsbindung,
zeigte aber zwei verbleibende UI-Luecken: Die native Karte blieb trotz
Tracker-Verbindung als manuell waehlbare Parallelansicht bestehen und der
Punktkontext war dichter und deutlich kleiner gesetzt als das Original.
EFB-Sourcekandidat 0.4.5 macht die native Karte deshalb zu einer reinen
Tracker-aus-Fallback-Karte. Sie zeigt nur Basiskarte/Aero-Overlay, letzte Route
und letzte Position; Positionsbanner, Kompass, Profil, Werkzeuge und Status-
Navigation bleiben dort unsichtbar. Die schmale Fallback-Menueleiste liegt
unterhalb des Simulator-Chromes und erklaert ihren Zustand. Sobald
`efb.web-client.v1` verfuegbar ist, wechselt die App ohne Benutzereingriff in
den tracker-gehosteten Kartentisch; bei Verbindungsverlust kehrt sie zur
Fallback-Karte zurueck.

Tracker v343/Host 0.5.8 vergroessert Popup, Schrift, Zeilenabstand und
Touchflaechen, ordnet Hoehenband und Detailkarten ueber identische nummerierte
Luftraummarker zu und blendet den Kompass waehrend des Kontexts aus. Nahe
Flugplaetze erhalten eine App-nahe Vollansicht mit ICAO/Name, Hoehe,
Entfernung/Peilung, Pisten, Frequenzen, AIP-Link sowie eingebettetem
Punktwetter, Windrose, QNH und abgeleiteter Flugwetterkategorie. Eine
Assetrevision in Host-CSS/-JS und iframe-View verhindert, dass Coherent nach
einem Trackerwechsel den vorherigen Hoststand aus dem Cache verwendet.

## Roadmap

### E0 - Read-only EFB stabilisieren

Status: in Alpha-Test

Testergebnis 2026-08-08: EFB 0.2.0 laeuft auf dem primaeren Testsystem sowohl
am physischen Cockpit-EFB als auch im 2D-Panel ohne Orientation-Flapping.
Tracker v324, Flugtelemetrie und der technische Missionssnapshot werden
angezeigt. Der Gegentest auf dem urspruenglich betroffenen Testsystem steht noch
aus. Eine alte beendete Mission kann in `mission.snapshot.v1` weiterhin als
letzter technischer Zustand erscheinen; Snapshot v2 muss aktive und letzte
Mission eindeutig trennen.

- EFB 0.2.0 ueber den Tracker-Desktop-Manager installieren und aktualisieren.
- Portrait/Landscape in den betroffenen Flugzeugen sowohl am physischen
  Cockpit-EFB als auch im 2D-Pop-out pruefen.
- Ohne Tracker, mit Tracker, mit aktivem Flug und mit aktiver Mission testen.
- Tracker-Neustart, EFB-Schliessen/Oeffnen sowie Offline-/Recovery-Anzeige
  pruefen.
- Browser/Web-Mission parallel gegenpruefen; 0.2.0 darf den bestehenden Ablauf
  nicht veraendern.
- Nach Freigabe exakt das Alpha-ZIP nach Stable promoten.

### E1 - `mission.snapshot.v2`

Status: erster Authority-/Resume-Unterbau implementiert, Alpha-Test ausstehend

Die Web-App bleibt Missionsautoritaet und uebergibt dem Tracker einen
sanitisierten, reicheren Lesezustand. Der Tracker persistiert und serviert ihn
lokal. Der Snapshot soll mindestens enthalten:

- `missionId`, `runId`, `recipeId`, `missionType`, `taskDomain`
- Lifecycle-, Runtime- und fachliche Unterphase
- Etappen, aktuelle Etappe und naechster Schritt
- `allowedActions` und strukturierte `blockingReasons`
- reduzierte Cargo-/Boarding-/Deboarding-Zustaende
- aktive untergeordnete Workflows, zunaechst read-only
- `revision`, `updatedAt`, `authority` und `stateHash`

Die bestehende `/api/v1/mission`-Antwort bleibt fuer EFB 0.2.0 erhalten. Eine
neue Capability, beispielsweise `mission.snapshot.v2`, schaltet die reichere
Darstellung gezielt frei. Zugangsdaten, Pilot-PIN und unnoetige persoenliche
Daten duerfen nicht in den Snapshot gelangen.

#### E1a - Persistenter Mission-Run und Geräteuebergabe (Tracker v325)

Der erste v2-Unterbau loest den bisherigen Split-Brain-Fall, ohne die gesamte
fachliche State-Machine bereits in den Tracker zu kopieren:

- Der Tracker persistiert genau einen `activeRun` in
  `mission-authority-v1.json`. Der Run enthaelt `missionId`, `runId`,
  `ownerClientId`, Revision, Phase, Resume-Bundle und ein begrenztes
  Effektjournal.
- `mission.authority.v1` und `mission.snapshot.v2` werden nur im neuen
  Relay-Hello angeboten. Fehlt die Capability, verwendet die Web-App weiterhin
  unveraendert den v320-Vertrag.
- Ein Missionsstart muss zuerst `mission_authority_acquire` erfolgreich
  abschliessen. Ein anderer Missionslauf erhaelt `conflict`; der abgelehnte
  Befehl darf weder Status noch Simulatorszene veraendern.
- Eine fremde App loescht den Tracker-Stand nie mehr automatisch. Sie zeigt den
  aktiven Tracker-Run an und kann nach ausdruecklicher Bestaetigung Snapshot,
  Owner und Runtime uebernehmen.
- Die Bindung verwendet eine zufaellige, lokal persistierte Client-ID,
  `runId` und Revision. Es wird kein zusaetzliches Sitzungsgeheimnis ueber das
  externe Relay transportiert; Sync-ID/PIN bleiben dessen bestehende
  Zugangskontrolle.
- Alte Web-Clients koennen bei leerem Tracker weiterhin implizit einen
  Legacy-Run starten. Solange dieser Legacy-Run aktiv ist, funktionieren ihre
  bisherigen Befehle und ihr terminales Lifecycle-Event. Ein alter Client darf
  aber keinen bereits von einem versionierten Client gehaltenen Run mutieren.
- Fuer einen impliziten `legacy-client`-Run ohne ersten Resume-Snapshot gibt es
  einen bestaetigten Recovery-Pfad: Nur eine lokal exakt passende Missions-ID
  darf den Run uebernehmen und muss sofort einen vollstaendigen, vom Tracker
  bestaetigten Resume-v2-Snapshot setzen. Fremde Missionen und fremde
  versionierte Owner bleiben gesperrt.

Das Resume-Bundle verwendet `ga.mission-resume.v2`. Primaeradapter sind
`apt`, `poi`, `survey_pattern`, `poi_chain`, `training`, `bush_pickup` und
`sar_heli`. Cargo, Behoerdenkontrolle, Flugschreiber und Passenger-Comfort
werden als zusaetzliche Facetten restauriert. Damit teilen sich einfache A-B-
Missionen und komplexe POI-/Pattern-Missionen denselben Transportvertrag, ohne
ihre fachlich verschiedenen Fortschrittsobjekte zu vermischen.

Freigabesemantik:

- Normaler Abschluss: Authority erst nach Debrief/Cleanup als `completed`
  freigeben.
- Mission Reset: Run als `reset` freigeben, Runtime/Szenen bereinigen, das
  vorhandene Briefing lokal wieder auf `planned` setzen.
- Dispatch-Clear: Run als `cleared` freigeben und danach Briefing entfernen.
- Neue Mission oder Direct-to: laufenden Run nur nach ausdruecklicher
  Abbruchbestaetigung als `aborted` freigeben.
- App schliessen, Reload oder Tracker-Neustart: keine Freigabe. Der persistente
  Run bleibt die Missionswahrheit.

Das Effektjournal dedupliziert wiederholte Szenen-, Boarding-, Deboarding- und
Smoke-Commands anhand stabiler `commandId` und speichert ausschliesslich eine
kleine technische ACK-Zusammenfassung. Es ist die Grundlage fuer sichere
Retries, ersetzt aber noch nicht den spaeteren vollstaendigen, headless
Missionsausfuehrungskern.

Mehrgeraetetest 2026-08-10, erster v325-Stand: Der Tracker-Run und der explizite
Handoff funktionierten, der uebernommene Runtime-Snapshot wurde jedoch vom
lokalen Fresh-Start-Schutz als `state:fresh-start` verworfen. Dadurch schrieb
das neue Geraet seinen lokalen `prepare`-/Boardingstand zurueck, obwohl der
Tracker bereits `boarded` oder `active` gespeichert hatte. Zusaetzlich
verarbeiteten beide Browser die ueber das Relay ausgestrahlten ACKs des jeweils
anderen Clients. Web-Cache v1614 behebt beides: `authorityConfirmed` wird bis
zum Runtime-Restore durchgereicht, fremde Mission-ACKs werden per lokaler
`commandId` ignoriert und der vorherige Owner wird bei einer neueren
Owner-Revision zum schreibgeschuetzten Beobachter demotiert. Semantische
Start-/Runtime-Phasenwechsel werden sofort zum Tracker geschrieben; der
periodische 10-Sekunden-Pfad bleibt nur fuer nichtkritische Zwischenstaende.

Folgetest 2026-08-10, Web-Cache v1615: Traf ein persistenter Tracker-Run auf
einen Browser ohne lokalen Authority-Eintrag, griff der Revisionsvergleich auf
`local.revision` statt `local?.revision` zu. Der Fehler brach jedes kombinierte
GPS-/Authority-Paket vor dem LIVE-Update ab; sichtbar blieb nur `LINK`, obwohl
Tracker und Relay verbunden waren. Web-Cache v1616 macht den Vergleich
nullsicher und kapselt Authority-Projektionen zusaetzlich so, dass ein kuenftiger
Authority-Fehler niemals die eigentliche Flugtelemetrie verwirft. Der
Cloud-Upload protokolliert ausserdem Roh-, Kompakt- und Komponentengroessen fuer
die Diagnose; eine Aenderung des serverseitigen Profil-Limits ist davon
getrennt.

Nach ausdruecklicher Freigabe wurde das bestehende Profil-Limit anschliessend
von 100 auf 256 KiB erweitert. Das bleibt weit unter den Cloudflare-Grenzen,
fuegt keine Datenfelder und keinen Dienst hinzu und veraendert weder die Anzahl
der Worker-Requests noch der KV-Schreibvorgaenge. Stable-Clients mit kleineren
Profilen bleiben kompatibel; die Alpha-App behaelt ihre stufenweise
Kompaktierung und nutzt nur den groesseren Sicherheitsabstand.

### E2 - Reinen Missionsausfuehrungskern extrahieren

Status: geplant

Ein neuer gemeinsamer Kern, Arbeitstitel `mission-execution-core.js`, kapselt:

- Normalisierung und Validierung eines Mission Execution Bundle
- `reduce(state, event)` fuer deterministische Phasenuebergaenge
- `deriveView(state)` fuer Anzeigephase, naechsten Schritt und Blocker
- `allowedActions(state)` fuer Web und EFB
- versionierte Serialisierung, Migration und State-Hash
- deklarative Effekte mit stabiler `effectId`, aber keine Ausfuehrung der Effekte

Der Kern darf kein DOM, `window`, `localStorage`, Voice, Relay, CommBus,
SimConnect oder Dateisystem direkt verwenden. Zeit, Zufall und Telemetrie werden
als explizite, normalisierte Ereignisse eingespeist. Sim- und Live-Modus nutzen
dieselbe State-Machine; der Sim-Modus emuliert lediglich Eingabeereignisse.

Beispielereignisse:

- `MISSION_ACCEPTED`, `PREPARE_REQUESTED`, `MISSION_STARTED`
- `BOARDING_STARTED`, `BOARDING_CONFIRMED`, `LOAD_CONFIRMED`
- `AIRBORNE`, `TARGET_ENTERED`, `TASK_PROGRESS`, `TOUCHDOWN`, `GROUND_STILL`
- `PICKUP_CONFIRMED`, `UNLOAD_CONFIRMED`, `FAREWELL_COMPLETED`
- `COMPLIANCE_EVENT`, `CLOSE_REQUESTED`, `MISSION_CLOSED`

Die vorhandenen fachlichen Wahrheiten bleiben erhalten: Cargo- und
Manifestkriterien kommen aus `mission-cargo-core.js`; Voice erzaehlt den
Zustand, bestimmt ihn aber nicht; `sync.js` bleibt zunaechst Adapter und
Orchestrator. Eine Verhaltenaenderung ist in dieser Phase nicht vorgesehen.

### E3 - Tracker-Shadow-Modus

Status: geplant

Web und Tracker verarbeiten dasselbe Execution Bundle und dieselben Ereignisse.
Die Web-App bleibt alleinige Autoritaet; der Tracker rechnet nur mit und
vergleicht:

- Phase und Unterphase
- erlaubte Aktionen und Blocker
- Cargo-/Workflow-Projektion
- Revision und State-Hash
- erzeugte deklarative Effekte

Abweichungen werden mit einem redigierten Event-Trace protokolliert. Replays
muessen in Browser und Node denselben Endzustand liefern. Shadow-Ergebnisse
duerfen keine Szenen, Voice oder Missionsabschluesse ausloesen.

### E4 - Autoritaet kontrolliert an den Tracker uebergeben

Status: geplant

Die Uebergabe erfolgt recipe-weise: zuerst ein normaler APT-A-nach-B-Ablauf,
danach Bush/Pickup, POI/Survey und zuletzt SAR sowie komplexe Sonderablaeufe.

Jeder Missionslauf fuehrt mindestens:

- `missionId`, eindeutige `runId` und `schemaVersion`
- `authority: web | tracker`
- monoton steigende `revision`
- `updatedAt` und `stateHash`

Der Wechsel `web -> tracker` verwendet erwartete Revision, Zustands-Hash und
ACK. Erst nach erfolgreichem ACK wird die Web-App zum Beobachter. Bei
Wiederverbindung uebernimmt sie den Trackersnapshot und schreibt nicht aufgrund
eines aelteren lokalen Zustands zurueck. Tracker-Persistenz muss atomar sein;
Recovery und Rollback werden vor der ersten Alpha-Autoritaet getestet.

### E5 - Schreibende EFB-Intents

Status: geplant

Der heutige offene GET-Loopback wird nicht einfach um ungeschuetzte POSTs
erweitert. Schreibzugriff benoetigt:

- eigene Capability, beispielsweise `mission.intent.v1`
- kurzlebige lokale Sitzung beziehungsweise Token
- Allowlist fachlicher Intents statt frei setzbarer Phasen
- `commandId`, erwartete Revision und Idempotenz
- Schema- und Zustandsvalidierung sowie Rate-Limits
- nachvollziehbare ACK-/Fehlerantworten

Beispiele sind `confirm_load`, `start_mission`, `confirm_pickup`,
`submit_compliance_evidence` und `request_close`. Nicht erlaubte Aktionen werden
vom Tracker mit einem strukturierten Blockierungsgrund abgewiesen.

### E6 - Bord-/Behoerdenkontrolle als untergeordneter Workflow

Status: geplant

Die Compliance-Logik wird nicht isoliert in den Tracker verschoben. Sie haengt
von Manifest, Boarding, Voice, Inspector-Szenen, Sanktionen und
Missionsabschluss ab und wird deshalb als verschachtelter Workflow gefuehrt:

```text
mission
|- flightPhase
|- groundOperations
|- cargo
`- workflows
   `- complianceInspection
```

Zuerst wird ihr Zustand in `mission.snapshot.v2` nur dargestellt. Danach werden
fachliche Bewertung und Phasenreducer transportneutral extrahiert. Szenen und
Voice bleiben Effekte; Profil-/Cloud-Synchronisation kann ueber eine persistente
ausstehende Effect-Queue erfolgen.

## Kompatibilitaets- und Rolloutregeln

- Stable Tracker v320 bleibt so lange gueltig, wie er den bestehenden
  Web-/Relay-Vertrag erfuellt. Alpha darf nicht pauschal den neuesten Tracker
  verlangen.
- Tracker ohne `mission.snapshot.v2` behaelt den aktuellen Web-Autoritaetsmodus.
- EFB blendet Aktionen aus oder deaktiviert sie mit Erklaerung, wenn eine
  Capability fehlt.
- Neue Trackerfelder und Nachrichten sind additiv. Unbekannte Felder muessen
  von alten Clients ignoriert werden koennen.
- Persistenzmigrationen sind vorwaertskompatibel oder erhalten einen getrennten
  Schema-/Datenpfad mit Import und Rollback.
- Jede Autoritaetsstufe beginnt in Alpha, laeuft im Shadow-Modus und wird erst
  nach dokumentiertem Test recipe-weise freigegeben.

## Testgates fuer den Missionskern

Vor jeder Autoritaetsfreigabe muessen mindestens bestehen:

1. Event-Replay in Web und Node mit identischem State-Hash.
2. APT-, Bush-, Pickup-, POI/Survey- und betroffene Sonderrezept-Selftests.
3. Cargo-, Boarding-, Deboarding- und Mission-Close-Blocker.
4. Tracker-Neustart in mehreren Missionsphasen ohne doppelten Effekt.
5. Web-Verbindungsverlust und Wiederverbindung ohne Rollback oder Split-Brain.
6. Doppelte, verspaetete und in falscher Reihenfolge eintreffende Intents.
7. Sim- und Live-Modus mit identischem fachlichem Zustandsverlauf.
8. Stable-Tracker-Fallback gegen die aktuelle Alpha-Web-App.

## EFB-Releaseablauf

1. Version in Source und PackageDefinition synchron setzen.
2. Mit der zum installierten MSFS-2024-SDK gehoerenden offiziellen Template-App
   bauen; Abhaengigkeiten per Lockdatei festhalten.
3. Offizielles Package Tool ausfuehren und `manifest.json`, `layout.json`,
   Dateigroessen und Hashes validieren.
4. In-Sim-Test im betroffenen Flugzeug und Darstellungsmodus.
5. `prepare-release.js` erzeugt ein Archiv mit genau einem Paket-Root.
6. ZIP unter `efb-app-v<version>` unveraenderlich hochladen und den Remote-Hash
   kontrollieren.
7. Erst danach `efb/channel/alpha.json` mit exakter URL, Groesse und SHA-256
   aktivieren und nach `origin/main` pushen.
8. Nach Testerfreigabe `stable.json` auf exakt dasselbe Artefakt setzen.

## Naechste priorisierte Schritte

- [x] EFB 0.2.0 am physischen EFB und im 2D-Panel des primaeren Testsystems
      ohne Orientation-Flapping getestet.
- [ ] EFB 0.2.0 auf dem urspruenglich betroffenen Testsystem gegenpruefen.
- [ ] EFB 0.2.0 ohne/mit Tracker sowie ohne/mit aktiver Mission testen.
- [ ] Testergebnis und betroffenen EFB-Modus in dieser Datei dokumentieren.
- [x] `K0 Map Shell` als isolierten EFB-0.3.0-Prototyp implementieren:
      OpenTopo mit Beschriftung, VFR-/Aero-Defaultoverlay, Flugzeugmarker,
      Pan/Zoom, Auto-Follow, Layerauswahl und Offline-/Fehlerzustand.
- [x] EFB 0.3.0 mit dem offiziellen Windows-SDK 1.7.2 bauen; der erste
      In-Sim-Test zeigte nur Header/Trackerstatus und eine schwarze
      Kartenflaeche. 0.3.0 wird nicht ausgeliefert.
- [x] EFB 0.3.1 mit eindeutigen View-Klassen und Initialisierung nach
      `onAfterRender` bauen und testen. View-Switch und Tracker-Recovery laufen,
      Karten- und Statusflaeche bleiben jedoch unsichtbar; 0.3.1 wird nicht
      ausgeliefert.
- [x] EFB 0.3.2 mit expliziter Vollflaechen-Geometrie und Layoutgroessen-Gate
      bauen und testen. Karte, Tiles, Flugzeugmarker und Zoom funktionieren;
      Layer-/Follow-Bedienelemente reagieren noch nicht. 0.3.2 wird nicht
      ausgeliefert.
- [x] EFB 0.3.3 mit getrennter Pointer-Overlay-Ebene bauen und testen. Leaflet-
      Zoom funktioniert weiterhin, aber Layer, Follow und Karte/Status bleiben
      ohne Wirkung; 0.3.3 wird nicht ausgeliefert.
- [x] EFB 0.3.4 mit echten DOM-`onclick`-Handlern bauen und testen. Karte/Status,
      Layerdialog, Layerauswahl und Follow funktionieren neben Pan und Zoom.
- [x] EFB 0.3.5 mit 50-Prozent-Basiskarten-Deckkraft beim Aero-Overlay, dem
      gelben 40-px-Web-Flugzeugmarker und entprellter Missionsanzeige durchs
      offizielle SDK bauen, im 2D-/physischen EFB testen und als
      `efb-app-v0.3.5` im Alpha-Kanal freigeben.
- [x] Additiven Karten-Datenvertrag `map.snapshot.v1` fuer Route, Navigation,
      Missionsgeometrie und Planprofil entwerfen, ohne den bestehenden Tracker-
      Mindeststand global anzuheben; Source-Implementierung in Tracker v326.
- [x] EFB-0.4.0-Source mit App-Designs, einklappbarer Menueleiste, Route,
      planbasiertem Hoehenband, Kompass, Uhr/Stoppuhr, lokalem Rechner und
      gebuendeltem E6B implementieren.
- [x] EFB 0.4.0 mit offiziellem Windows-SDK 1.7.2 bauen und im Simulator
      pruefen. Ergebnis verworfen: Web-Design und Werkzeugfunktion fehlen,
      E6B zeigt nur die Entwicklungsmaske, Unicode-Zeichen und Coherent-CSS
      werden teilweise nicht dargestellt.
- [x] EFB-0.4.1-Source mit Kartentisch-naher Toolbar, echten lokalen Uhr- und
      Rechnerkomponenten, ASCII-sicheren Controls und dem vollstaendigen
      interaktiven E6B fuer Coherent korrigieren.
- [x] EFB 0.4.1 mit offiziellem Windows-SDK bauen und im Simulator testen.
      Aktive Route, Flugzeugposition und Werkzeuge funktionieren im 2D-/
      physischen EFB; Gestaltung/Funktionsnaehe bleibt der Grund fuer 0.4.2.
- [x] Den exakten 0.4.1-SDK-Input mit `efb-v0.4.1-sdk-input` markieren und
      0.4.2 in einem getrennten Branch/Worktree beginnen.
- [x] Additive Tracker-Webclient-Probe fuer 0.4.2 implementieren: v327 meldet
      `efb.web-client.v1`; die Diagnose bleibt unter `/efb/v1/probe/` erhalten.
- [x] Ersten echten tracker-gehosteten 0.4.2-Kartentisch additiv implementieren:
      Original-DOM/-Styles/-Werkzeuge, Browser-kompatibler `map-shell-core`,
      read-only Hostadapter sowie native 0.4.1-Fallbackkarte.
- [x] Lokalen 0.4.2-Browser-Gate fuer Route, Flugzeug, Kompass, Planprofil,
      Designs, Toolbar, Layer, Stoppuhr, Rechner und E6B ohne Scriptfehler
      bestehen.
- [x] Tracker v327 mit allen Kartentisch-/E6B-Assets als Windows-EXE bauen und
      EFB 0.4.2 durchs offizielle SDK schicken. In-Sim-Ergebnis: HTML/CSS-
      Huelle sichtbar, externe Host-Skriptkette nicht initialisiert;
      Schliessen konnte dadurch in eine fehlende Funktion laufen.
- [x] 0.4.3/v328 mit sequenziellem Coherent-Bootstrap, fruehem ausfallsicherem
      Schliessen, iframe-Channel und begrenztem lokalen Client-/Asset-Logging
      implementieren; lokale Protokoll-, Quellen- und HTTP-Tests bestanden.
- [x] Tracker v328 und EFB 0.4.3 auf Windows bauen und im Simulator Bootstufen
      und Schliessen pruefen. Ergebnis: Transport/Channel funktionieren;
      Coherent bricht an `?.` und `...` ab, deshalb kein Hoststart.
- [x] 0.4.4/v329 mit durchgaengigem Coherent-Syntaxgate, Runtime-Polyfills,
      lokalen CSS-Hintergrundplatzhaltern und rotiertem Tracker-Debuglog
      implementieren; lokale Quellen-, Webclient- und Logtests bestanden.
- [x] Tracker v329 und EFB 0.4.4 auf Windows bauen und im Simulator pruefen.
      Ergebnis: Host, Karte, Route, Flugzeug, Toolbar und Logrotation laufen;
      Rechner (`trimEnd`), E6B (`flatMap`) und Freihandzeichnen brauchen v330.
- [x] Tracker v330 / gehosteten Kartentisch 0.4.5 mit Runtime-Fallbacks,
      E6B-iframe-Diagnose, Freihandzeichnen und zustandsabhaengigen Karten-/
      Parent-Updates implementieren; lokaler Rechner-, E6B-, Stoppuhr- und
      Zeichentest bestanden. Das installierte EFB-Paket bleibt 0.4.4.
- [x] Tracker v330 mit vorhandenem EFB 0.4.4 auf Windows/In-Sim starten.
      Ergebnis: Kartentisch, Route, Flugzeug, Kompass und Werkzeuge erreichen
      den vorgesehenen Host; der Test meldet als Restpunkte Terrainprofil,
      Legwechsel, Fensterbedienung und gelegentliches Kartenflackern.
- [x] Tracker v331 / gehosteten Kartentisch 0.4.6 mit kompaktem
      Tracker-Terrainprofil, lokaler Wegpunktvorschau, verschieb-/schliessbaren
      Infoboxen und festen Leaflet-Panes implementieren. Browser-End-to-End-
      Test bestaetigt Terrain, Legwechsel sowie Schliessen/Wiederherstellen;
      Quellen-, Snapshot- und Webclienttests bestanden.
- [x] Tracker v332 / gehosteten Kartentisch 0.4.7 mit dauerhaft sichtbarer
      Basiskarte, skalierten Zeichenkoordinaten, Parent-E6B-Drehflaeche,
      getrenntem Leg-Schliessen-Knopf und read-only Mission-/Checklistenmenue
      implementieren. Lokaler Browsertest bestaetigt Karte nach Aero-Ladung,
      Terrainband, Legwechsel, E6B-Rotation, Rechner und Freihandlinie.
- [x] Tracker v332 mit vorhandenem EFB 0.4.4 auf Windows/In-Sim testen.
      Ergebnis: Route/Overlay bleiben sichtbar, aber extern geladene
      Basiskacheln verschwinden nach Kartenbewegung; ein alter Authority-Run
      bleibt ohne erneuten App-Push bei `planned-only`.
- [x] Tracker v333 / Host 0.4.8 mit lokalem, erlaubnislistenbasiertem
      Karten-Tile-Proxy samt 32-MiB-RAM-Grenze und sofortigem App-Terrain-Push
      implementieren; HTTP-, Cache-, Quellen- und Syntaxtests bestanden.
- [x] Web-App-Cloud-Pull gegen einen aktiven Tracker-Run absichern: manueller
      Pull verwendet die bestaetigte Tracker-Geraeteuebergabe, stiller Pull
      aktualisiert nur die uebrigen Profildaten, und eine fremde Cloud-Mission
      kann keine Scene-/Lifecycle-Befehle mehr gegen den aktiven Run senden.
- [x] Tracker v333 mit vorhandenem EFB 0.4.4 und passendem lokalen App-Stand
      auf Windows/In-Sim testen. Ergebnis: Proxy-Tiles kommen an, aber der
      Coherent-Compositor stellt die transparente Aero-Ebene nach etwa einer
      Sekunde schwarz dar; der uebernommene Run bleibt ohne spaeten
      Routen-Trigger bei `planned-only`.
- [x] Tracker v334 / Host 0.4.9 mit vorhandenem EFB 0.4.4 auf Windows/In-Sim
      testen. Ergebnis: Der Proxy liefert Kacheln, Coherent zeigt sie dennoch
      schwarz. Die verwendete Local-App meldete Cache `v1603` und konnte daher
      den neuen Terrain-/Authority-Refresh nicht ausfuehren.
- [x] Tracker v335 / Host 0.5.0 mit vorhandenem EFB 0.4.4 auf Windows/In-Sim
      testen. Ergebnis: Direkte Tiles bleiben sichtbar. Der Aero-Kontrast ist
      zu schwach; Terrain bleibt `planned-only`, weil die getestete Alpha
      `v1619` den Profilpush noch nicht enthaelt. Local `v1603 / NO SW` ist
      ebenfalls ein alter Quellstand und kein geeigneter Gegentest.
- [x] Tracker v336 / Host 0.5.1 mit vorhandenem EFB 0.4.4 und Webstand
      `ga-dispatcher-v1621` auf Windows/In-Sim testen. Ergebnis: Kartenkacheln,
      Route und Terrainband sind sichtbar; Routenupdates warten noch bis zu
      zehn Sekunden und hinterlassen Vektorartefakte, E6B-Drehung und
      Checklisten-Checkboxen reagieren im Coherent-Host noch nicht.
- [x] Tracker v337 / Host 0.5.2 mit vorhandenem EFB 0.4.4 und Webstand
      `ga-dispatcher-v1622` auf Windows/In-Sim testen. Ergebnis: Route wird
      schneller uebernommen; E6B-Vorderseite funktioniert. Windschieber,
      Windpunkt, Profil-Luftraeume/Hindernisse, Profilbedienung,
      `Was ist hier?`, Checklisten und korrigierter Zeichenpfad fehlen noch.
- [x] Tracker v338 / Host 0.5.3 mit vorhandenem EFB 0.4.4 und Webstand
      `ga-dispatcher-v1623` auf Windows/In-Sim testen. Ergebnis: Luftraeume
      kommen an, EFB-E6B und Profilbedienung funktionieren weitergehend. Die
      EFB-Hilfen waren jedoch versehentlich auch in der normalen Local-App
      gelandet; Kontextabfrage und Hindernissymbole waren noch grobe
      Platzhalter.
- [x] Tracker v339 / Host 0.5.4 mit vorhandenem EFB 0.4.4 und Webstand
      `ga-dispatcher-v1624` in Local gegentesten. Ergebnis: Klappmenues,
      Karten-Langdruck und Kontext sind vorhanden, aber der normale App-E6B
      zeigt wegen unvollstaendiger Quelltrennung zwei Buttonsets.
- [x] Tracker v340 / Host 0.5.5 mit vorhandenem EFB 0.4.4 und Webstand
      `ga-dispatcher-v1626` auf Windows/In-Sim getestet: E6B-Quelltrennung ist
      vorhanden; der 650-ms-Karten-Langdruck loest im Coherent-EFB jedoch
      wegen des reinen Pointer-Pfads nicht aus.
- [x] Tracker v341 / Host 0.5.6 mit vorhandenem EFB 0.4.4 auf Windows/In-Sim
      getestet: Der Langdruck oeffnet das Kontextfenster. Das Fenster bezog
      seine Inhalte jedoch noch falsch vom naechsten Routenwegpunkt statt vom
      gedrueckten Kartenpunkt.
- [x] Tracker v342 / Host 0.5.7 mit vorhandenem EFB 0.4.4 auf Windows/In-Sim
      geprueft: Der Langdruck zeigt den lokalen Flugplatz, das tatsaechliche
      Gelaende, Wetter und die Luftraeume am Kartenpunkt statt eines fernen
      Routenwegpunkts. Offen blieben Lesbarkeit, eindeutige Zuordnung im
      Hoehenband, Flugplatz-Vollansicht und die parallele native Karte.
- [x] Tracker v343 / Host 0.5.8 zusammen mit dem offiziell gebauten EFB-0.4.5-
      Community-Paket auf Windows/In-Sim geprueft und als Releasekandidat
      verworfen: Nach dem Tracker-Handshake wechselte die Parent-App im
      Sekundentakt in den iframe und wegen eines spaeteren Poll-/Renderfehlers
      sofort wieder auf `about:blank`. Neustartversuche erzeugten zusaetzlich
      `EADDRINUSE`, weil die erste Tracker-Instanz Port 49880 weiter belegte.
- [x] Tracker v344 / Host 0.5.8 zusammen mit dem offiziell neu gebauten
      EFB-0.4.6-Community-Paket auf Windows/In-Sim pruefen: Der iframe muss
      nach erfolgreichem Handshake geladen bleiben; einzelne Poll- oder
      Parent-Renderfehler duerfen ihn nicht entladen. Erst drei aufeinander-
      folgende Kernfehler duerfen zur Fallback-Karte wechseln. Eine zweite
      Tracker-Instanz muss mit eindeutiger Portmeldung beendet werden. Danach
      den Punktkontext bei EDTL und den Rueckwechsel bei echtem Tracker-Ende
      erneut pruefen. Normale App-Dateien und der Web-App-Cache bleiben
      unveraendert.
- [x] Tracker v345 / Host 0.5.9 zusammen mit dem offiziell neu gebauten
      EFB-0.4.8-Community-Paket auf Windows/In-Sim geprueft: Parent-Profil ohne
      `Array.flatMap`, Fallback-Layerauswahl, 30 Prozent kleineres E6B,
      kontrastreiches Rechner-Formblatt, zentrierte Luftraumlabels,
      Piste in der Wetter-Windrose, entfernten AIP-Link und Toolbar-X sowie
      ASCII-sichere Kontexttexte sind bestaetigt. Der Datenfooter und das
      Debuglog nennen Quelle und Einzelzeiten. Die 0.4.8-Fallback-Karte zeigt
      keinen Positionsstreifen mehr; Tracker-Umschaltung und Rueckfall sind
      stabil.
- [ ] Tracker v326 bauen und zusammen mit EFB 0.4.1 gegen die Fallback-
      Darstellung mit Tracker v325 testen.
- [x] Authority-/Resume-Untervertrag fuer `mission.snapshot.v2` mit
      Einzel-Run, Owner, Revision, Effektjournal und Missionstyp-Adaptern
      implementieren; Alpha-In-Sim-/Mehrgeraetetest steht aus.
- [x] Web-seitigen Resume-Snapshot zum Tracker transportieren und persistent
      speichern; vollstaendige fachliche Tracker-Runtime bleibt eine spaetere
      Ausbaustufe.
- [ ] Tracker v325 gegen zwei Browsergeraete testen: Konflikt ohne Flackern,
      expliziter Handoff, Reload, Tracker-Neustart, Reset, Clear, Direct-to und
      normaler Abschluss.
- [ ] Web-Cache v1614 gegen den konkreten Boarding-Handoff erneut testen:
      `boarded` und `active` muessen vom Tracker gewinnen; auf dem alten Geraet
      duerfen keine fremden Boarding-/Szenen-ACKs den lokalen Zustand aendern.
- [ ] Web-Cache v1616 mit einem bereits persistenten Tracker-Run und einem
      Browser ohne lokalen Authority-Eintrag testen: Anzeige muss von LINK auf
      LIVE wechseln und danach den Handoff anbieten.
- [ ] Web-Cache v1618 mit dem realen `legacy-client`-Run ohne Snapshot testen:
      ein Geraet mit derselben Mission setzt nach Bestaetigung den Rettungsstand;
      das zweite Geraet bezieht danach den normalen Tracker-Snapshot. Eine
      andere lokale Mission muss abgewiesen werden.
- [x] EFB-Mission-Control zunaechst ohne Schreibaktionen darstellen: Der
      v346/0.4.9-Quellstand projiziert die vorhandene App-Sicht begrenzt ueber
      das Authority-Bundle und den lokalen Tracker-HTTP-Endpunkt.
- [x] Tracker v346 und EFB 0.4.9 auf Windows bauen und In-Sim testen:
      Modern-Design, Umschaltung, quadratische Checkboxen und read-only Mission
      Control sind bestaetigt. Custom-Listen fehlten, weil der Windows-Checkout
      den vorgesehenen App-Export-Patch nicht enthielt; v347 ersetzt diese
      Abhaengigkeit durch den direkten Tracker-Cloudabruf.
- [x] Tracker v347 und EFB 0.4.10 auf Windows bauen und In-Sim pruefen:
      Breite, globale Schriftwahl und Custom-Listen funktionieren; der Test
      zeigt jedoch den Scroll-Ruecksprung bei Liveupdates und verbliebene
      ASCII-Transliterationen in EFB-Fallbacktexten.
- [x] Tracker v348 und EFB 0.4.11 offiziell auf Windows bauen und In-Sim testen:
      Mission Drawer mit zwei Dritteln Breite, stabiler Touch-/Wheel-Scroll,
      echte deutsche Umlaute und unveraenderter direkter Cloudabruf.
- [x] Tracker-v349-Hibernate als additiven Relay-Hotfix implementieren und
      automatisiert pruefen: Null-/Menueposition und SimStop sofort, Bodenstillstand nach
      fuenf Minuten unter 5 kt oder nach fuenf Minuten Pause, sofortiges
      Aufwachen bei Flugzustand, 5 kt beziehungsweise aufgehobener Pause;
      Commands, ACKs und lokaler EFB-Pfad bleiben aktiv.
- [x] Tracker v349 real in MSFS fuer ACTIVE -> HIB pruefen: Der Pause-Timer
      wechselte nach fuenf Minuten, Cloudflare und Render blieben verbunden,
      und Commands, ACKs sowie der lokale EFB-Pfad arbeiteten im HIB weiter.
- [x] Tracker-v350-Wake-Vertrag implementieren und automatisiert pruefen:
      letzte Position im HIB-Status, einmaliger App-Open-Wake, Command-Wake fuer
      Mission, Route, Cargo, Szene und Homebase sowie gemeinsamer Timer-Reset.
- [x] Tracker-v351-Hotfix gegen den real beobachteten 45-Sekunden-Crew-Poll
      implementieren und automatisiert pruefen: unveraenderte Polls senden
      keinen neuen App-Command; alte beziehungsweise doppelte Crew-Commands
      erhalten tracker-seitig `noop` und loesen keinen HIB-Wake aus.
- [x] Tracker v351 real bis ACTIVE -> HIB pruefen: HIB trat nach fuenf Minuten
      Pause ein und der Homebase-Poll hielt ihn nicht mehr wach. Der Test fand
      drei Folgeluecken bei Kartendarstellung, App-/Routen-Wake und dem nach
      Menueende haengenden Pause-Flag; diese sind in v352 korrigiert.
- [ ] Tracker v352 real in MSFS fuer ACTIVE -> HIB -> ACTIVE pruefen und dabei
      letzte Kartenposition, App-/Routeninteraktion, Menueende, Flugzustand,
      Traffic, Homebase, Mission-/Payload-Commands und lokalen EFB-Snapshot
      abgleichen, bevor derselbe Release nach Stable promoviert wird.
- [ ] Tracker v353 und Desktop 1.6.1 real pruefen: `C+R`/`C`/`R`,
      `LIVE`/`HIB`/`LINK`/`OFF`, HIB ueber geplanten App-Schlaf sowie eine
      identische und eine 3/2-abweichende Checklistenbibliothek abgleichen.
- [ ] Schnittgrenze fuer `mission-execution-core.js` anhand der vorhandenen
      Runtime-, Cargo- und Compliance-Tests festlegen.
- [ ] Tracker-Shadow-Replay implementieren, bevor Autoritaet verschoben wird.

## Entscheidungsprotokoll

- 2026-08-17: Tracker-Desktop 1.6.2 akzeptiert Pilot-PINs nun wie die Web-App
  mit 4 bis 8 Ziffern statt ausschliesslich vier Ziffern. Eingabe, lokale
  Vorpruefung, DPAPI-gespeicherte Zugangsdaten und Klartext-Alt-Migration nutzen
  denselben Vertrag; insbesondere die von der App erzeugten sechsstelligen PINs
  bleiben nach einem Desktop-Neustart gueltig. Der Auth-Endpunkt war bereits
  laengenunabhaengig und musste nicht geaendert werden. Der Windows-x64-Installer
  ist als unveraenderliches Release `tracker-desktop-v1.6.2` veroeffentlicht
  (100.262.313 Bytes, SHA-256
  `23d6093d7f8de0b790ce140d646f79d2d8a5e97da3b8df89d71c8a33c5335123`).
  Der frisch von GitHub geladene Installer stimmt in Groesse und Hash mit dem
  lokalen Build ueberein. Der globale Desktop-Autoupdate-Zeiger liefert 1.6.2
  an Alpha, Beta und Stable; die getrennten Tracker-Runtime- und EFB-Kanaele
  bleiben unveraendert.

- 2026-08-17: Der additive Gruppen-Szenenvertrag ist lokal im Tracker-v357-
  Kandidaten und in der Web-App implementiert. Die Capability
  `mission.scene.group.v1` schaltet 2-5 Personen, zentrierte 1-m-Aufstellung,
  1100-ms-Stagger und die feste Fahrzeugwahl Van fuer 2-3 beziehungsweise
  Minibus/Bus fuer 4-5 Personen frei. Partielle Spawns oder Routen duerfen
  weder ein erfolgreiches ACK noch Manifestfortschritt ausloesen. Der
  Windows-Build ist lokal und remote verifiziert (48.109.342 Bytes, SHA-256
  `fd63d93715a5451482352c941757f3b9709db148d327d31cab90119c007024c6`),
  als Release `v357` veroeffentlicht und nur in `channel/alpha.json`
  freigeschaltet. Stable bleibt bis zum realen MSFS-Test auf v356.

- 2026-08-17: Der erste reale Aufruf des Gruppen-Debug-Helfers erreichte den
  Tracker, wurde aber mit `ack:conflict` abgewiesen, weil der Testbefehl noch
  unter die normale Missions-Authority fiel. Der v358-Alpha-Kandidat erlaubt
  deshalb nur streng validierte `mission-scene-group-debug-*`-Befehle ohne
  Mission-/Run-Zuordnung und ohne Eintrag im aktiven Authority-Lauf. Normale
  Missionsszenen koennen diese Ausnahme nicht verwenden. Der erneute MSFS-Test
  ist nach Alpha-Veroeffentlichung von v358 ausstehend. Der lokale Windows-
  Build umfasst 48.110.783 Bytes und hat SHA-256
  `46d13bed5983410f94fb0c8e5028de3d2896ccf62841e440ceee63e668b56af0`.

- 2026-08-17: Flugzeug-Preset-Profile, Sitzplatzgrenzen und spaetere
  Charter-/Privat-/Sightseeing-Gruppen werden nach dem lokalen
  `docs/Aircraft-Mission-Integration-Plan.md` schrittweise integriert. Die
  Gruppenanimation bleibt ein additiver Szeneneffekt hinter
  `mission.scene.group.v1`; bestehende Boarding-/Deboarding-ACKs, Manifest-
  Handoff und Missionsphasen bleiben unveraendert. App-Aenderungen gehen nach
  `origin/main`. Der dafuer notwendige neue Tracker wird zuerst ausschliesslich
  als Alpha-Artefakt veroeffentlicht; Stable bleibt bis zur ausdruecklichen
  Testerfreigabe auf dem bisherigen unveraenderten Release.

- 2026-08-17: Nach erfolgreicher Alpha-Freigabe und erneuter Live-Pruefung der
  GitHub-Release-Assets wurden Tracker v356 und EFB 0.4.11 in die Stable-
  Kanaele promotet. `channel/stable.json` verweist auf Tracker-v356, die
  Stable-EFB-Kanaldatei auf `efb-app-v0.4.11`; beide verwenden dieselben
  unveraenderlichen URLs, Groessen und SHA-256-Pruefsummen wie Alpha.

- 2026-08-14: Tracker v354 / Host 0.6.3 ist als Alpha veroeffentlicht und
  korrigiert das von einem Nutzer
  gemeldete Flackern des FAA-Sectional-Overlays. Die Analyse zeigte keinen
  Clear-, Reload- oder Layer-Rebuild-Loop. FAA und das
  transparente DWD-WMS erbten im tracker-gehosteten EFB jedoch Leaflets
  `plus-lighter`, weil nur Resilient-Tiles die bisherige Hostklasse erhielten;
  zugleich lagen Aero, FAA/DFS und DWD gemeinsam in einer Pane. Der EFB-Host
  erzwingt deshalb fuer alle Raster-Tiles normalen Blend-Modus und trennt wie
  die App VFR (280), offizielle Karten (310) und Wetter (340). App-Kartencode
  und native Fallback-Karte bleiben unveraendert.

- 2026-08-14: Der reale v352-Lauf bestaetigte Kartentisch-Wake und spaeteren
  App-Open-Wake aus `hibernate:paused`. Kurze Render-/Cloudflare-Neuverbindungen
  wurden funktional ueberstanden, die App beschriftete geplanten Schlaf oder
  Reconnect jedoch zeitweise als `OFF`. v353 reserviert `OFF` fuer einen
  tatsaechlich beendeten Tracker und trennt `LINK`, `HIB` und `LIVE` sichtbar.
  Dasselbe Log belegte einen wiederholten Checklistenwechsel 3 -> 2: Die App
  lieferte drei lokale Listen, waehrend der direkte Cloud-Poll einen
  unvollstaendigen Zweierindex als Ersatz behandelte. v353 macht den
  App-Snapshot sitzungsautoritativ, meldet identischen Cloudinhalt als `noop`
  und fuellt fehlende beziehungsweise neuere lokale Listen kontrolliert in den
  Cloud-Index zurueck. Stable bleibt auf v320.

- 2026-08-14: Der reale v351-Test bestaetigte den HIB-Eintritt nach exakt fuenf
  Minuten, zeigte aber drei unabhaengige Wake-Luecken. Der 5-Sekunden-Status
  enthielt die letzte Position, ohne sie bei spaeter aufgebauter Karte zu
  zeichnen. Die getestete Routenaenderung erreichte den Wake-Pfad nicht, und
  nach dem Menueende blieb ein Pause-Event-Flag gesetzt. v352 zeichnet deshalb
  einen gekennzeichneten HIB-Marker, weckt bei vertrauenswuerdiger App-
  Interaktion und umfassender erkannten Routenaenderungen und behandelt
  Pause-Ende, SimStart, PositionChanged und FlightLoaded als Timer-Reset. Nach
  kurzer Uebergangsfrist sind die Pause-SimVars autoritativ. Stable bleibt auf
  v320.

- 2026-08-14: Der reale v350-Bodentest zeigte keinen HIB-Uebergang, weil der
  Homebase-Gruppenpoll alle 45 Sekunden seine Vergleichssignatur loeschte und
  ein unveraendertes `homebase_v1.crew.set` als Sim-Interaktion sendete. v351
  behaelt die App-Signatur ueber Polls hinweg. Als zweite Sicherung fuehrt der
  Tracker die Signatur der zuletzt erfolgreich aufgebauten Crew-Szene und
  beantwortet identische Wiederholungen mit `noop`, ohne SimObjects neu
  aufzubauen oder HIB-Timer zurueckzusetzen. Echte Crew-Aenderungen wecken den
  Tracker unveraendert. Stable bleibt bis zum realen Uebergangstest auf v320.

- 2026-08-14: Tracker v350 behandelt Hibernate ausschliesslich als
  Telemetrie-Drosselung. `telemetry.wake.v1` weckt Boden-/Pause-HIB durch einen
  expliziten App-Open-Wake oder jeden Sim-relevanten App-Command. Mission-
  Authority-Snapshots transportieren Routen- und Fortschrittsaenderungen auch
  im HIB weiter zum Tracker und damit zum lokalen EFB. Cargo-/Payload- und
  Homebase-/Szenenbefehle werden erst geweckt und danach unveraendert
  ausgefuehrt. Der HIB-Status fuehrt die letzte gueltige Position samt
  kompaktem Boden-/Pause-Zustand; Menue-/Nullpositionen bleiben bewusst
  gesperrt. Das Aufheben einer Regel und jeder akzeptierte Wake setzen beide
  Fuenf-Minuten-Timer gemeinsam zurueck. Stable bleibt bis zum realen Test auf
  v320. Die vollstaendige automatisierte Web-/Tracker-/Desktop-/EFB-Testmatrix
  ist mit 140 Tests gruen.

- 2026-08-14: Der erste reale v349-Lauf bestaetigt `ACTIVE -> HIB` um
  `06:42:23Z` nach 300 Sekunden Pause. Cloudflare war seit `06:37:21Z`
  verbunden; Render folgte nach einem einmaligen Handshake-Retry um
  `06:37:43Z`. Beide Verbindungen blieben danach offen. Im HIB kamen weiterhin
  Homebase-, Szenen-, Mission-Authority-, Payload- und Checklisten-Commands an;
  ihre ACKs sowie der lokale EFB-Cloud-/Loopback-Pfad liefen weiter. Ein realer
  Wake-Uebergang ist in diesem Log noch nicht enthalten und bleibt offen.

- 2026-08-14: Die Homebase-Crew-Capability-Aushandlung wird in Web-Cache
  `ga-dispatcher-v1634` gegen Rueckkopplung begrenzt. Eine fruehe, gueltige
  Capability-Antwort ohne `homebase-crew-scene` loest keinen rekursiven
  Sofortversuch mehr aus. Negative Antworten, fehlende ACKs und Sendefehler
  duerfen denselben Request erst nach 15 Sekunden wiederholen; ein neuer
  Relay-Verbindungs-Token setzt den Gate-Zustand kontrolliert zurueck. Die im
  HIB weiterlaufenden 5-Sekunden-Statuspakete koennen den spaeter bereiten
  SimConnect-Objektmanager neu aushandeln, ohne volle GPS-Telemetrie zu
  benoetigen.

- 2026-08-14: Fuer vergessene Tracker-Instanzen wird die 2-Hz-Relay-Telemetrie
  in v349 gezielt hiberniert. Bodenstillstand benoetigt fuenf Minuten mit
  `SIM ON GROUND` und weniger als 5 kt; die MSFS-Nullpositionen `(0,0)` und
  pausiert `(0,90)` sowie `SimStop` greifen sofort; eine beliebige
  durchgehende Pause greift nach fuenf Minuten. Das dabei beobachtete
  `Menu N` wird nicht als Signal verwendet. Der Tracker liest SimConnect lokal
  weiter, versorgt das EFB,
  verarbeitet Commands/ACKs und sendet alle fuenf Sekunden einen Status. Die
  Web-App zeigt `HIB` mit Relaykennung und Grund. Stable bleibt bis zum realen
  MSFS-Test auf v320.

- 2026-08-14: Tracker v349 ist als Alpha veroeffentlicht. 88 automatisierte
  Tracker-/EFB-Tests sind gruen. Die Windows-x64-EXE wurde nach dem Upload
  frisch von GitHub heruntergeladen und mit 48.069.653 Bytes sowie SHA-256
  `9d77e876d3c20a78cf3bdb56b1f13a918d6d30b33f955283733cac07895cea4e`
  gegen den lokalen Build validiert. Das EFB-Paket bleibt unveraendert auf
  0.4.11; Stable bleibt auf Tracker v320.

- 2026-08-13: Tracker v348 und EFB 0.4.11 sind als Alpha veroeffentlicht. Der
  offizielle SDK-1.7.2-Build und der nachfolgende In-Sim-Test wurden
  freigegeben. Beide Artefakte wurden nach dem GitHub-Upload frisch
  heruntergeladen und gegen Groesse und SHA-256 geprueft; das EFB-Archiv wurde
  zusaetzlich entpackt und als Paketversion 0.4.11 validiert. Alpha zeigt auf
  exakt diese unveraenderlichen Releases; Stable bleibt unveraendert.

- 2026-08-13: Der 0.4.10/v347-In-Sim-Test bestaetigt den direkten Cloudabruf
  und die groessere Mission Control. Der sekundenweise Missionspfad konnte den
  Drawer waehrend des Scrollens jedoch vollstaendig neu aufbauen und damit die
  Coherent-Geste abbrechen. 0.4.11/v348 ignoriert volatile Relay-/Flugfelder
  fuer den strukturellen Rendervergleich, aktualisiert Livewerte gezielt,
  puffert echte Inhaltsupdates waehrend der Interaktion und stellt die
  Scrollposition nach dem Layout wieder her. Die Breite wird auf zwei Drittel
  reduziert; sichtbare EFB-Fallbacktexte und kombinierende Umlautzeichen werden
  als echtes UTF-8 ausgegeben. Der veroeffentlichte Dual-Relay-Stand aus `main`
  bleibt vollstaendig enthalten; der Stand wurde danach als v348/0.4.11 fuer
  Alpha freigegeben.

- 2026-08-13: Der erste 0.4.9/v346-In-Sim-Lauf bestaetigt die stabile
  Umschaltung, das Modern-Design, anklickbare Checklisten und Mission Control.
  Das Windows-Ergebnis enthielt jedoch nicht den vorgesehenen App-Patch fuer
  `checklist.library.v1`; deshalb konnten Custom-Listen nicht zum Tracker
  gelangen. Fuer 0.4.10/v347 liest der Tracker nach ausdruecklicher Freigabe
  denselben privaten GA-Sync wie die App direkt und behaelt bei Abruffehlern
  seinen letzten lokalen Cache. Gleichzeitig wird Mission Control auf 75
  Prozent Breite erweitert, die Missionstypografie vergroessert, eine globale
  Schriftwahl unter `Anzeige` angeboten und HTML-Text zentral von nicht
  darstellbaren Coherent-Symbolen bereinigt. Alpha bleibt auf v345/0.4.8.

- 2026-08-13: Fuer den naechsten isolierten Kandidaten EFB 0.4.9/Tracker v346
  wird die EFB-Designauswahl entfernt; die vorhandene Classic-Kennung bleibt
  nur als interner Name des Modern-Styles bestehen. Eigene Checklisten laufen
  capability-gesteuert App -> Relay -> Tracker-Persistenz -> lokaler EFB-
  Endpunkt. Ihre Inhalte werden begrenzt, der EFB-Abhakstand bleibt lokal.
  Mission Control uebernimmt eine sanitierte Projektion derselben Daten, die
  das App-Missionsmenue bereits nutzt, ohne Missionsregeln oder Schreibaktionen
  in den Host zu kopieren. 53 EFB-/Tracker-Tests sowie eine lokale Browser-
  Pruefung von Anzeige, Custom-Liste, Checkbox-Toggle und Reload-Persistenz sind
  bestanden. Alpha bleibt bis zum Windows-SDK-/In-Sim-Test auf v345/0.4.8.

- 2026-08-13: Cloudflare Durable Objects ist als primaerer Relay-Pfad (`C`)
  produktiv unter `ga-relay.einherjer.workers.dev` bereitgestellt; Render bleibt
  als unabhaengiger Fallback (`R`). Tracker v346 sendet denselben 2-Hz-Stand an
  beide Dienste. Die Web-App empfaengt nur ueber den aktiven Dienst, wechselt
  bei Socket-Ausfall oder nach einer erfolgreichen Tracker-Probe auf Render und
  prueft von dort periodisch die Rueckkehr zu Cloudflare. Alte Tracker bleiben
  dadurch ueber Render nutzbar. Das Cloudflare-Durable-Object nutzt gehashte
  Raumschluessel, Hibernation-WebSockets, Rollenrouting und ein timerfreies
  Telemetrie-Gate. Lokale Worker-, Routing-, Cache-, Authority-, Storage-,
  Auth- und Homebase-Tests bestanden. Live wurden Cloudflare-Drosselung,
  unverzoegerte Commands sowie der gemeinsame `C -> R`-Fallback mit einem
  temporaeren Raum bestaetigt. Web-Cache v1630 aktiviert die Umstellung.
- 2026-08-13: Der Render-Relay begrenzt kontinuierliche GPS-Telemetrie
  serverseitig auf 2 Hz. Weil der oeffentliche Render-WebSocket-Pfad trotz
  beidseitiger Aktivierung kein `permessage-deflate` aushandelt, verwendet die
  Web-App zusaetzlich die additive Relay-Capability `gzip-base64-v1`. Nur
  ausdruecklich kompatible Browser erhalten gebuendelte Telemetrie als
  `relay_compressed`-Huelle; Legacy-Clients, Tracker, Workbench, Commands, ACKs
  und Heartbeats behalten den bisherigen JSON-Vertrag. Damit ist fuer den
  Kompressions-Hotfix kein neuer Tracker- oder EFB-Build erforderlich.
- 2026-08-13: Der 0.4.6/v344-In-Sim-Test bestaetigt stabilen iframe-Wechsel
  und Rueckfall, zeigt im Parent aber weiterhin einen Coherent-Renderfehler an
  `Array.flatMap`. EFB 0.4.7 ersetzt ihn durch eine Schleife und laesst in der
  reduzierten Fallback-Karte ausschliesslich die Basiskarten-/Layerauswahl
  wieder zu. Tracker v345/Host 0.5.9 verkleinert E6B und verbessert Rechner-
  Formblatt sowie Punktkontext. Luftfahrtdaten verwenden primaer die bereits
  von der App genutzte gehostete GA Aviation DB; bei Fehlern folgt der
  OpenAIP-Regioncache mit stabilen 0,5-Grad-Schluesseln. Wetter und Terrain
  bleiben parallele Open-Meteo-Abfragen. Quelle und Laufzeit werden getrennt
  diagnostiziert.

- 2026-08-13: EFB 0.4.7/Tracker v345 wurde im Simulator als stabil
  bestaetigt. In der Tracker-aus-Fallback-Karte blieb jedoch die native
  `flight-strip` mit "Aktuelle Position" sichtbar. EFB 0.4.8 blendet auch
  dieses Chrome-Element aus; Tracker v345/Host 0.5.9 bleibt unveraendert.
  Der letzte offizielle SDK-1.7.2-Build bestand Package-, Quellen- und
  Kompatibilitaetspruefung und wurde am 13.08.2026 im Simulator freigegeben.
  Damit sind EFB 0.4.8 und die unveraenderte Tracker-v345-EXE fuer Alpha
  freigegeben; Stable bleibt bis zum gesonderten Testerentscheid unveraendert.

- 2026-08-12: EFB 0.4.6 behandelt Tracker-Kernpoll, optionale Snapshots und
  Parent-Darstellung als getrennte Fehlerbereiche. Eine erfolgreiche
  Capability-Erkennung startet den Host-iframe nur nach gueltiger Status- und
  Snapshotverarbeitung; spaetere Darstellungsfehler koennen ihn nicht mehr
  sofort entladen. Bei einer bestehenden App-Karte werden bis zu zwei
  aufeinanderfolgende Kernpollfehler toleriert und als
  `efb.client-diagnostics.v1` protokolliert. Tracker v344 beendet eine zweite
  Instanz gezielt, wenn Port 49880 bereits belegt ist.

- 2026-08-12: EFB 0.4.5 trennt die native Fallback-Karte von der
  tracker-gehosteten App-Karte. Die Fallback-Karte ist nur bei fehlendem
  `efb.web-client.v1` sichtbar und enthaelt ausschliesslich Karte/Aero-Overlay,
  letzte Route und letzte Position. Tracker v343/Host 0.5.8 vergroessert und
  strukturiert `Was ist hier?`, fuegt die Flugplatz-Vollansicht hinzu und
  versioniert die geaenderten Hostassets gegen Coherent-Caches. Diese Arbeiten
  bleiben auf EFB- und Tracker-Dateien begrenzt.

- 2026-08-12: Host 0.5.7/v342 fuehrt `map.context.v1` als begrenzten
  Tracker-Loopback-Vertrag ein. Nach ausdruecklicher Benutzerfreigabe werden
  nur die gedrueckten Koordinaten fuer OpenAIP-/Open-Meteo-Leseabfragen
  verwendet. Der Host zeigt keine Routenwegpunkte mehr als Ersatz fuer
  Ortsdaten und uebernimmt Aufbau und Inhalte des originalen App-Kontexts
  enger, ohne gemeinsame App-Dateien zu aendern.

- 2026-08-12: Host 0.5.6/v341 verwendet fuer den EFB-Karten-Langdruck im tracker-gehosteten
  Kartentisch einen isolierten Pointer-/Mouse-/Touch-Adapter. Damit folgt der
  Kontextpfad den nachgewiesenen Coherent-Eingabefallbacks, ohne `map.js`,
  `map-utility-tools.js`, E6B-App-Dateien oder den Web-App-Cache zu aendern.

- 2026-08-12: Webstand v1626 ersetzt fuer das normale App-E6B die feste
  `320%`-Iframe-Arbeitsflaeche zur Laufzeit durch den realen Visual Viewport.
  Damit ist der Bewegungsraum nicht mehr von der Panel-Pixelbreite abhaengig.
  Der EFB-Fork bleibt unveraendert und durch den bestehenden Sync-Test
  getrennt.

- 2026-08-12: Host 0.5.5/v340 schliesst die in v339 noch unvollstaendige
  E6B-Trennung. Normale App und EFB besitzen getrennte HTML-, CSS-, Runtime-
  und Werkzeugquellen. Der Shared-Asset-Sync validiert alle vier EFB-Forks,
  statt sie mit den App-Dateien zu ueberschreiben. Die normalen Dateien sind
  gegen den unveraenderten Alpha-Stand geprueft; App-Glyphen und
  `localControls: true` sind wiederhergestellt.

- 2026-08-12: Host 0.5.4/v339 isoliert alle Coherent-E6B-Eingriffspfade in
  `ga-tracker-client/efb-web-assets`; die entsprechenden normalen App-Dateien
  sollten getrennt werden; der erste Local-Test deckte jedoch zwei verbliebene
  gemeinsame Quellen auf. Die EFB-Kopfleiste nutzt
  nun Klappmenues, Karten-Langdruck oeffnet den erweiterten lokalen Kontext und
  Hindernisse erhalten typbezogene Profil-Symbole. Der bestehende Snapshot
  bleibt begrenzt; AIP-/Wetter-Details werden noch nicht on demand nachgeladen.

- 2026-08-12: Host 0.5.3/v338 haelt den EFB-Livepfad lokal: Das EFB pollt den
  Tracker auf `127.0.0.1:49880`; nur das kompakte, begrenzte Profilpaket kommt
  mit dem Missions-Authority-Snapshot Web-App -> Relay -> Tracker. Die lokale
  Browser-QA bestaetigt E6B-Windschieber und Windpunkt, Kontextpopup,
  Profil-Luftraeume/Hindernisse, Profilregler und Profilgriff, verschiebbare und
  schliessbare Infofenster, persistente Checklisten sowie einen Zeichenpfad
  ohne horizontalen Versatz. 29 automatisierte EFB-Tests sind erfolgreich.

- 2026-08-12: Der v336-In-Sim-Log zeigt fuer E6B Vorder-/Rueckseite einen
  vollstaendigen Boot, aber keine einzige `e6b-action`-Drehgeste; Coherent
  liefert auf der transparenten Eingabeflaeche damit keine verlaesslichen
  Pointer-Events. Host 0.5.2/v337 ergaenzt Mouse und Touch, ersetzt drei
  problematische Unicode-Symbole durch ASCII und behandelt Checklistenhaken
  als explizite Click-Aktion. Ein zweiter, 240 ms versetzter Authority-Push
  faengt Routenmutationen ab, deren erster Render-Callback noch den vorherigen
  Stand sah. Leaflet-Routen werden als neue Gruppen mit eigenen SVG-Renderern
  eingesetzt, damit der Coherent-Compositor keine alten Canvas-Pixel behaelt.

- 2026-08-12: Der v335-Log zeigt nach erfolgreicher Authority-Uebernahme nur
  `map-profile:planned-only`; danach folgen Runtime-Snapshots, aber kein
  `terrain-profile-ready`. Die getestete Alpha ist Cache v1619, waehrend der
  Profilpush erst im neueren Quellstand vorhanden ist. Webstand v1621 bindet
  deshalb die aktuelle Kartenroute explizit in das bestehende Resume-Bundle
  ein, sendet Routenmutationen sofort ohne veraltetes Profil und laesst den
  fertigen Terrainabruf als zweiten Authority-Snapshot folgen. Es entsteht
  kein zweiter Missionszustand und kein neuer Relay-Kanal. Host 0.5.1/v336
  setzt fuer Aero denselben Kontrast wie der Web-Kartentisch und protokolliert
  Route, Profilmodus und Punktzahl direkt im Trackerlog.

- 2026-08-12: Der v334-Log bestaetigt erfolgreiche Antworten des lokalen
  Tile-Proxys, waehrend die Kartentisch-Flaeche schwarz bleibt. Da die native
  EFB-Karte direkte HTTPS-Tiles auf demselben System sichtbar rendert, nutzt
  Host 0.5.0/v335 je Kachel zuerst die direkte Quelle, danach deren Backup und
  erst zuletzt den weiterhin begrenzten Loopback-Proxy. Der gleichzeitig
  angezeigte lokale Web-Cache `v1603` erklaert den fehlenden v334-Terrain-Push
  und unsaubere versionsuebergreifende Authority-Wechsel. Lokale Server senden
  deshalb konsequent `no-store`; private Entwicklungs-Hosts entfernen alte
  GA-Service-Worker und zeigen `NO SW` an.

- 2026-08-12: Der v333-In-Sim-Test trennt Netzwerk und Darstellung: Topo- und
  Aero-Tiles werden vom lokalen Proxy erfolgreich geliefert, erst das spaeter
  eintreffende transparente Aero-PNG verdeckt die Basiskarte im Coherent-
  Compositor schwarz. Host 0.4.9/v334 begrenzt deshalb dessen Deckkraft auf
  eine rendererfeste Beimischung, reserviert die native EFB-Kopfzeile und
  setzt den Layerdialog kontrastreich. Nach einer bestaetigten Tracker-
  Uebergabe wird der bestehende Web-App-Terrainabruf ausserdem erneut
  angestossen, sobald die restaurierte Route bereit ist; der Tracker bleibt
  dabei ohne eigenen Hoehendienst.

- 2026-08-12: Der v332-In-Sim-Log bestaetigt `map-profile:planned-only`; das
  Terrain war beim ersten Authority-Snapshot noch nicht fertig und loeste
  spaeter keinen neuen Push aus. Zugleich verschwinden direkt von Coherent
  geladene externe Basiskacheln nach Kartenbewegungen. Host 0.4.8/v333 nutzt
  fuer die fest erlaubten Kartendienste daher den lokalen Tracker-HTTP-Server
  mit begrenztem RAM-Cache. Terrain wird weiterhin ausschliesslich aus den
  bereits von der Web-App geladenen Punkten uebernommen; der Tracker sendet
  keine Route an einen neuen Hoehendienst.

- 2026-08-12: Der v331-In-Sim-Test zeigt, dass die Basiskarte erst nach dem
  Eintreffen des Aero-Layers ausbleicht, Zeichnen unter der Coherent-Skalierung
  versetzt ist und Pointer nicht verlaesslich in das E6B-iframe gelangen.
  Hoststand 0.4.7/v332 korrigiert diese drei Hostgrenzen ohne SDK-Neubau. Das
  neue Seitenmenue bleibt read-only: Missionswahrheit kommt vom Tracker,
  Checklistenhaken bleiben reine lokale EFB-Praeferenz. Das Terrainband kann
  nur echtes Terrain anzeigen, wenn die passend aktualisierte Web-App den
  kompakten `mapProfile` beim Missionsstart in das Tracker-Bundle schreibt;
  der Tracker protokolliert den verwendeten Modus explizit.

- 2026-08-11: Der v330-In-Sim-Test bestaetigt die grundsaetzliche
  Kartentisch-Hostgrenze, zeigt aber vier getrennte Restprobleme: Dem
  bisherigen Snapshot fehlt echtes Terrain, die Legpfeile haben keine lokale
  Vorschaufunktion, die Original-Infoboxen besitzen im EFB keine
  Fenstersteuerung und Leaflet-Layer koennen beim Aktualisieren ihre sichtbare
  Reihenfolge wechseln. Tracker v331 loest das additiv im read-only Hoststand
  0.4.6. Das Terrain kommt als kleiner `mapProfile`-Untervertrag im
  Tracker-Authority-Bundle und nicht im Cloud-Payload. Legwechsel bleiben
  reine EFB-Vorschau; Fensterpositionen bleiben lokale UI-Praeferenz. Kein
  Punkt erhaelt damit Missions- oder SimConnect-Schreibrechte, und das
  installierte Community-Paket 0.4.4 braucht keinen erneuten SDK-Build.

- 2026-08-11: Der 0.4.4/v329-In-Sim-Test erreicht erstmals den vollstaendigen
  tracker-gehosteten Kartentisch. Die verbleibenden Werkzeugfehler sind keine
  SDK- oder Transportfehler: Coherent fehlt `String.trimEnd` im Rechner und
  `Array.flatMap` im E6B-Fallback. Tracker v330 ergaenzt diese Methoden in
  Parent und E6B-iframe, meldet E6B-Boot/JSON/Fallback getrennt, implementiert
  Freihandlinien sowie Undo/Clear und entprellt unveraenderte Live-, Routen-
  und Markerdaten. Weil alle Aenderungen in den vom Tracker ausgelieferten
  Assets liegen, ist dafuer kein erneuter SDK-Build des installierten
  Community-Pakets 0.4.4 erforderlich.

- 2026-08-11: Der 0.4.3-In-Sim-Log belegt erfolgreiche HTTP-Ladung aller
  Skripte, aber Parserabbrueche an Optional Chaining in `map-shell-core.js`
  und Object Spread in `map-utility-tools.js`. 0.4.4/v329 ersetzt diese sowie
  Nullish Coalescing und die weiteren Spread-Vorkommen auch im echten E6B und
  sichert das mit einem Quellen-Gate fuer alle Coherent-facing Skripte ab.
  Der fruehe Bootstrap stellt kompatible Standardmethoden wie
  `Object.entries`, `Array.includes` und `Element.replaceChildren` bereit.
  Gleichzeitig wird `ga-tracker-debug.txt` ab dem ersten v329-Logeintrag auf
  hoechstens 8 MiB aktive Daten plus zwei kleine Tail-Archive begrenzt;
  uebergrosse Altdateien werden nicht vollstaendig umbenannt, sondern sofort
  auf die letzten 512 KiB reduziert. Unmittelbar identische Logzeilen werden
  fuer 1,5 Sekunden entprellt und Einzelzeilen auf 32 KiB begrenzt.

- 2026-08-11: Der Windows-/SDK-Test von 0.4.2 zeigt im Simulator nur die
  originale Kartentisch-Huelle. Tracker v327 bleibt nach dem Klick aktiv und
  liefert `host.js` lokal mit HTTP 200; die fehlenden Hosttexte, Karte und
  Buttons belegen damit einen Abbruch vor der Hostinitialisierung, keinen
  Tracker-Absturz. 0.4.3/v328 laedt die externe Skriptfolge ohne `defer`, legt
  einen ES5-sicheren Inline-Bootstrap davor und macht Schliessen unabhaengig
  vom grossen Hostadapter. Der lokale Diagnose-POST ist auf Loopback, 8 KiB
  je Meldung und 120 Meldungen pro Minute begrenzt. Wiederholte unveraenderte
  Hangartor-Scans werden nur noch bei Aenderung oder als Fuenf-Minuten-
  Heartbeat geloggt, damit die EFB-Bootspur sichtbar bleibt.

- 2026-08-11: Der In-Sim-Test von 0.4.1 bestaetigt aktive Route, korrekt
  positioniertes Flugzeug und bedienbare Werkzeuge. Damit ist der markierte
  0.4.1-Stand ein belastbarer Fallback. Auf ausdrueckliche Freigabe wurde die
  0.4.2-Hostgrenze deshalb vom reinen Probe-Dokument zum echten Kartentisch-
  View erweitert. Der Tracker liefert Original-DOM, Original-Styles,
  `map-utility-tools.js`, Leaflet und die vollstaendigen E6B-Assets; ein neuer
  read-only Adapter bindet `flight.snapshot.v1` und `map.snapshot.v1` an.
  `map.js`/`profile.js` bleiben unveraendert und werden nicht in die Tracker-
  Runtime geladen. Ohne `efb.web-client.v1` bleibt die native 0.4.1-Karte.

- 2026-08-11: Vor der Zerlegung der grossen Kartentischdateien wurde der
  0.4.1-SDK-Input als lokaler Git-Tag `efb-v0.4.1-sdk-input` eingefroren und
  0.4.2 in `codex/efb-map-server-0.4.2` isoliert. Der laufende 0.4.1-Build wird
  nicht abgewartet, aber 0.4.2 bleibt bis zu dessen Ergebnis additiv. Eine
  kleine Tracker-Webclient-Probe muss zuerst Laden, Interaktion, Resize und
  Snapshotzugriff in Coherent nachweisen; erst danach beginnt die eigentliche
  Extraktion. Die native 0.4.1-Karte bleibt capability-gesteuerter Fallback.

- 2026-08-11: Der In-Sim-Stand 0.4.0 wird nicht freigegeben. Die EFB-Shell
  muss sich sichtbar und funktional am bestehenden Web-Kartentisch
  orientieren; fuer bereits vorhandene Werkzeuge wird keine rein dekorative
  Ersatzmaske akzeptiert. 0.4.1 verwendet fuer den E6B die originalen Front-
  und Windscheiben samt Interaktionslogik, erzwingt Embedded-Coherent per
  Fragment statt nur per Query und legt die Scheiben beim Build als lokalen
  Preload ab. Kritische EFB-Geometrie verwendet keine von SDK 1.7.2
  problematisch behandelten Kurzformen; Controls und technische Anzeigen
  bleiben bis zum Nachweis weiterer Fonts auf ASCII-sicheren Zeichen.

- 2026-08-10: EFB 0.4.0 wird als eigener Browser-Client des lokalen Trackers
  gebaut, nicht als eingebettete Vollversion der Web-App. `map.snapshot.v1`
  trennt Route, Live-Navigation, Missionsgeometrie und Planprofil von
  Narrative/Cloud. Das EFB besitzt eigene SDK-sichere Renderer und lokale
  UI-Praeferenzen; Tracker und Web teilen schrittweise reine Datenkerne. Die
  vorhandenen App-Designs werden als kompakte EFB-Themes uebernommen. Uhr,
  Rechner und E6B bleiben nicht missionskritische lokale Werkzeuge. Der
  Terrainverlauf des Hoehenbands folgt erst mit einem eigenen versionierten
  Datenprodukt.

- 2026-08-10: EFB 0.3.5 ist nach SDK-1.7.2-Build und In-Sim-Test als
  unveraendertes Alpha-Artefakt `efb-app-v0.3.5` freigegeben. Der Remote-
  Rueckdownload wurde mit 86.714 Bytes und SHA-256
  `c08566a59a22abba803370abd9d0480d80642e8a2a0175e48897d354946446b2`
  erneut validiert. `efb/channel/alpha.json` zeigt auf dieses Release; Stable
  bleibt unveraendert deaktiviert.
- 2026-08-10: Der Relay-Pfad verteilt Tracker-ACKs an mehrere verbundene
  Browser. Ab Web-Cache v1614 verarbeitet ein Browser missionsbezogene ACKs nur
  fuer selbst gesendete `commandId`. Ein Tracker-bestaetigter Handoff darf den
  lokalen Fresh-Start-Guard uebersteuern; ein abgeloester Owner stoppt seine
  Snapshot-Schreibversuche und bleibt Beobachter.
- 2026-08-10: Ein implizit angelegter `legacy-client`-Run ohne Resume-Snapshot
  darf nicht alle Geraete in einen Uebergabe-Deadlock bringen. Ab Web-Cache
  v1618 kann eine lokal identische Mission nach gesonderter Bestaetigung den
  Run uebernehmen und als ersten vollstaendigen Tracker-Snapshot setzen. Andere
  Missions-IDs und fremde versionierte Owner bleiben unveraendert gesperrt.
- 2026-08-10: Authority-Projektionen sind ein Zusatzkanal innerhalb eines
  Telemetriepakets. Fehler in diesem Zusatzkanal duerfen Position, Flugzustand
  und LIVE-Anzeige nicht mehr verwerfen; der Revisionsvergleich akzeptiert
  explizit einen noch nicht vorhandenen lokalen Authority-State.
- 2026-08-10: Das bestehende Cloud-Profil darf nach ausdruecklicher Freigabe bis
  256 KiB gross sein. Client und Worker verwenden dieselbe Grenze; die
  Sync-Frequenz und damit die Free-Kontingente nach Request-/Write-Anzahl bleiben
  unveraendert.
- 2026-08-10: Tracker v325 fuehrt vor der vollstaendigen Headless-Migration
  einen persistenten Einzel-Run als Missionswahrheit ein. Fremde Web-Apps
  beobachten diesen Run und koennen ihn nur ueber einen expliziten Handoff
  uebernehmen; die bisherige automatische Mismatch-Bereinigung entfaellt.
  Resume v2 deckt APT, POI, Survey, POI-Ketten, Training, Bush/Pickup und
  SAR-Heli sowie Cargo-/Compliance-Facetten ab. Reset, Clear, Abschluss, neue
  Mission und Direct-to besitzen getrennte Freigabegruende.
- 2026-08-10: Ab Tracker Desktop 1.6.0 aktualisiert sich auch die installierte
  Bootstrap-/Desktop-App ueber den getrennten Desktop-Kanal. Downloads werden
  per SHA-512-Metadaten geprueft, koennen automatisch vorbereitet werden und
  werden erst beim Beenden oder nach einem bestaetigten Neustart installiert.
  Aeltere Desktop-Versionen benoetigen einmalig den manuellen Wechsel auf 1.6.0.
- 2026-08-10: Der Tracker-Desktop-Manager ordnet Tracker, Homebase Assets, EFB
  und Bridge als standardmaessig geschlossene Module unter einer kompakten
  Status-/Startleiste. Updateentscheidungen sind pro Modul getrennt. Bereits
  installierte EFB-Pakete bieten neue Versionen per Dialog an oder werden bei
  aktivierter EFB-Automatik bei geschlossenem MSFS ohne Dialog aktualisiert;
  Erstinstallation, Reparatur und Deinstallation bleiben manuell.
- 2026-08-07: EFB wird als eigenes, vom Tracker verwaltetes Community-Package
  mit getrennten Alpha-/Stable-Kanaelen ausgeliefert.
- 2026-08-07: Erste Transportstufe bleibt HTTP-Loopback und vollstaendig
  read-only; EFB 0.2.0 nutzt `mission.snapshot.v1`.
- 2026-08-08: Langfristige Missionsautoritaet soll im Tracker liegen. Der
  Umbau erfolgt ueber Snapshot v2, reinen gemeinsamen Kern, Shadow-Modus und
  recipe-weise Autoritaetsuebergabe; kein direkter Umzug der Browser-Runtime.
- 2026-08-08: Bord-/Behoerdenkontrolle wird als untergeordneter Missionsworkflow
  geplant und erst nach gemeinsamer Kernextraktion schreibend ins EFB gebracht.
- 2026-08-08: Der Kartentisch mit flug- und missionsrelevanten Werkzeugen wird
  zum zentralen EFB-Produktziel. Hauptmenue und Pinnwand bleiben ausserhalb des
  EFB-Scopes. Die Umsetzung erfolgt als eigener EFB-Kartenclient auf gemeinsam
  extrahierten Modulen und versionierten Tracker-Vertraegen.
- 2026-08-08: `K0 Map Shell` wird als EFB 0.3.0 vorbereitet. OpenTopo mit Text
  und das VFR-/Aero-Overlay sind Default; weitere Onlinequellen bleiben opt-in.
  Der bestehende 0.2.0-Alpha-Kanal bleibt bis zum SDK- und In-Sim-Test aktiv.
- 2026-08-10: Der offizielle 0.3.0-SDK-Build war formal korrekt, zeigte In-Sim
  aber nur Header und Trackerstatus vor schwarzem Inhalt. 0.3.0 wird verworfen.
  0.3.1 trennt Karten-/Statuscontainer namentlich von Hoststyles und startet
  Leaflet garantiert nach `onAfterRender`; Initialisierungsfehler werden im UI
  und im EFB-Debugger sichtbar.
- 2026-08-10: 0.3.1 zeigt dasselbe schwarze Inhaltsfeld auch auf einem System
  mit funktionierender 3D-Ausgabe. Der View-Switch reagiert und ein beendeter
  Tracker aendert den Status weiterhin; die App ist daher nicht eingefroren.
  0.3.2 ersetzt `inset` in den Vollflaechen durch explizite Breite, Hoehe,
  `top` und `left` und prueft die DOM-Groesse vor der Leaflet-Initialisierung.
- 2026-08-10: 0.3.2 macht OpenTopo, VFR-/Aero-Overlay, Flugzeugmarker und Zoom
  im Simulator sichtbar und funktionsfaehig. Die schwebenden Layer-/Follow-
  Buttons reagieren noch nicht. 0.3.3 verschiebt die Karten-UI deshalb aus der
  Leaflet-Flaeche in eine eigene durchlaessige Pointer-Overlay-Ebene, deren
  Buttons Eingaben explizit annehmen.
- 2026-08-10: Auch mit der getrennten Pointer-Overlay-Ebene von 0.3.3 reagieren
  alle app-eigenen Buttons nicht, waehrend Leaflet-Zoom Eingaben verarbeitet.
  Die exakte SDK-Abhaengigkeit `@microsoft/msfs-sdk` 2.1.1 setzt unbekannte
  JSX-Props wie `onClick` lediglich als HTML-Attribute; sie registriert daraus
  keinen Listener. 0.3.4 entfernt diese JSX-Props und bindet die nativen Buttons
  nach `onAfterRender` ueber ihre DOM-`onclick`-Eigenschaft. Dieses Verfahren
  entspricht der internen Ereignisbindung des offiziellen EFB-`Button`.
- 2026-08-10: Der 0.3.4-In-Sim-Test bestaetigt alle app-eigenen Buttons als
  funktionsfaehig. 0.3.5 gleicht Aero-Basiskarten-Deckkraft und Flugzeugmarker
  an den Web-Kartentisch an. Wiederholt beobachtete `available:false`-Luecken
  zwischen gueltigen `mission.snapshot.v1`-Antworten werden nur in der EFB-
  Darstellung entprellt: bestaetigte Wahrheit bleibt maximal 12 Sekunden
  sichtbar, waehrend neue und terminale Snapshots sofort gewinnen. Diese
  Schutzschicht setzt selbst keine Missionsphase und verschiebt keine
  Missionsautoritaet.
