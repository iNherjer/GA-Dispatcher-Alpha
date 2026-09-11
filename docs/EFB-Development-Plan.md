# EFB-/Toolbar-Panel-Entwicklungsplan

Stand: 2026-09-06

Diese Datei ist der chatuebergreifende Einstiegspunkt fuer die Entwicklung der
MSFS-2024-Cockpit-Clients: EFB-App und globales Toolbar-Panel. Neue Chats lesen
zuerst diese Datei und danach, passend zur Aufgabe,
`docs/EFB-Tracker-Architecture.md`, `docs/EFB-Community-Package.md` und
`docs/github-push-workflow.md`. Architekturentscheidungen, Releases und
wesentliche Testergebnisse werden hier fortgeschrieben.

## Aktueller freigegebener Stand

| Bereich | Alpha | Stable | Bemerkung |
| --- | --- | --- | --- |
| Web-App | `origin/main` | getrennte Stable-Promotion | Alpha muss weiterhin mit dem freigegebenen Stable-Tracker funktionieren |
| Tracker-Desktop | 1.6.5 manueller Origin-Installer mit APT-Opt-in-Schalter und lokalem Hard-Reset | Auto-Update 1.6.2 | Stable bleibt Standard; Alpha und die experimentelle APT-Tracker-Steuerung muessen getrennt eingeschaltet werden |
| Tracker-Runtime | v382 als freigegebener APT-Feldkandidat | v356 | Manifest-, Start-, Payload-, Boarding-/Farewell-Voice- und Standard-APT-UI-Core sind gegen echte App-Fallbackfunktionen abgesichert. App und EFB nutzen denselben Mission-Control-Renderer und revisionsgebundene Intents. Passenger-Pickup sowie der reale Compliance-/Mehrinstanz-Gesamtnachweis bleiben offen. Training, POI, Bush/Pickup und SAR bleiben fail-closed. |
| EFB-Community-Package | 0.4.13 Alpha | 0.4.11 | Getesteter SDK-1.7.2-Build mit Open-/Resume-Recovery und begrenzten Wiederholungen; Stable bleibt auf 0.4.11 |
| Toolbar-Panel | Ziel definiert, noch nicht implementiert | - | Eigenes Community-Package; erster Schritt ist ein read-only SDK-/In-Sim-Spike mit dem tracker-gehosteten Kartentisch |
| EFB-/App-Transport | EFB ueber HTTP-Loopback, entfernte Origin-App ueber das bestehende PIN-geschuetzte Tracker-Relay | - | Beide Wege enden im selben revisionsgebundenen Intent-Controller. Provider-Keys und Session-Token werden nie oeffentlich projiziert. `mission.intent.v1` erscheint nur, wenn Alpha, Opt-in und Core-Paritaetsgate gemeinsam erfuellt sind. |

### EFB 0.4.13 – Alpha-Release vom 11.09.2026

Alpha verweist auf `efb-app-v0.4.13`. Der oeffentliche Download wurde vor
der Kanalumschaltung auf Dateigroesse, SHA-256 und Paketstruktur verifiziert.

Der Nutzer hat den Funktionstest von EFB 0.4.13 im Simulator bestaetigt und
den Alpha-Rollout freigegeben. Der offizielle SDK-1.7.2-Build wurde unter
MSFS 2024 1.8.16.0 getestet. onOpen und onResume erneuern den iframe-Kanal;
eine ausbleibende ready/live-Meldung loest nach 20 Sekunden maximal zwei
Wiederholungen aus. Pause stoppt die Frist, alte Kanaele koennen den neuen
Frame nicht bestaetigen. Logs enthalten Paketversion und Parent-Instanz.
Das Handoff-Log belegt Start/host-ready/live/load, aber nicht separat fuenf
Resume-Zyklen. Die Freigabe beruht auf dem menschlichen Funktionstest.
0.4.12 hatte den erneut gemeldeten Black Screen nicht vollstaendig behoben.
Das unveraenderte Testarchiv umfasst 432662 Bytes mit SHA-256
`8f2b31e85e147c7c1c0a94950aab87e615aa68fa1324cb3ab26711580615cdc7`.

### Alpha-Feldkandidat v380

Tracker v380 / Host 0.7.4 / Assetrevision 38001 ist der fuer den Alpha-Test
freigegebene Feldkandidat. Die gemeinsamen Manifest-,
Start-, Payload-, Boarding-/Farewell-, Standard-APT-UI- und Compliance-
Differentialtests sind lokal gruen. Deshalb meldet der Core fuer diesen
Kandidaten `TRACKER_AUTHORITY_READY=true` und bewirbt `mission.intent.v1`
ausschliesslich bei gleichzeitigem Alpha-Kanal und aktiviertem Desktop-Opt-in.
Stable sowie Alpha ohne Opt-in bleiben vollstaendig unter Web-Authority.
Die entfernte Origin-App reicht ihre Intents ueber das Tracker-Relay ein; das
lokale EFB verwendet weiterhin HTTP. Nach jeder erfolgreichen Aktion verteilt
der Tracker sofort denselben Authority-Snapshot an alle Ansichten. Mission
Control wird in App und EFB aus `mission-control-ui-core.js` erzeugt, sodass
Texte, Phasen, Bedingungen, Fortschritt und Bedienelemente nicht mehr in zwei
getrennten Renderern auseinanderlaufen koennen.

Der erste entfernte Origin-Test am 05.09.2026 zeigte eine Transportluecke vor
dem eigentlichen `prepare_mission`: Nach erfolgreichem Authority-Acquire
verlangte die App zusaetzlich eine HTTP-Session auf `127.0.0.1`, die ein
Quest-/Remote-Browser naturgemaess nicht zum Sim-PC aufbauen kann. Der
Handoff waehlt deshalb nun den bereits verbundenen Tracker-Relay-Controller
ohne Loopback-Voraussetzung. Nur Clients ohne aktiven Relay-Controller muessen
weiterhin eine lokale Cockpit-Session nachweisen. Ein ausfuehrbarer
Regressionstest prueft, dass Prepare und Commit ueber Relay laufen, ohne den
Loopback-Client zu starten. Der reale Wiederholungstest bleibt offen.

### Freigegebener Folgefix v380 / Desktop 1.6.5

Der Folgefix schliesst zwei reale Feldbefunde, ohne die APT-Semantik oder
Legacy-Authority zu aendern: Nach einem SimConnect-Reconnect reicht der
Tracker den vorhandenen vertrauenswuerdigen Cockpit-Controller jetzt wieder an
den neuen Command-Handler durch; App-Intents bleiben damit nicht mehr mit
`mission_execution_authority_not_enabled` haengen. Der EFB trennt ausserdem
den fachlichen Missionssnapshot von seiner Presentation-Signatur und zeichnet
Banner, Toolbar und geoeffneten Verlade-Manager bei identischen Polls nicht
neu, damit Coherent nicht blinkt oder Scroll-/Touch-Fokus verliert.

Desktop 1.6.5 ergaenzt einen bestaetigten lokalen Hard-Reset fuer aktive
Tracker-APT-Runs. Dieser verwendet vor dem Loeschen des lokalen Recovery-
Zustands den normalen Abort mit Payload-Restore und Szenenbereinigung und
ruft anschliessend die aktuelle App-Mission wieder ab. Kann der sichere Abort
nicht ausgefuehrt werden, bleibt der Run bewusst sichtbar und retrybar.

Diese Freigabe ist nur das technische Gate fuer Stufe E, nicht deren PASS:
Standard-APT-End-to-End, parallele App-/EFB-Bedienung, Reload/Duplicate-
Recovery, die exklusive Voice-Playback-Lease, Abort/Clear/neue Mission und
erzwungene Compliance muessen mit genau diesem unveraenderten Kandidaten real
im Simulator bestaetigt werden. Passenger-Pickup, Training, POI, Bush/Pickup
und SAR bleiben weiterhin fail-closed. Das EFB-Community-Paket bleibt auf
0.4.11; der Host wird von der Tracker-Runtime geliefert.

### Alpha-Folgefix v382

Tracker v382 startet den Standard-APT-Farewell-Job bereits beim bestaetigten
Ziel-Touchdown. Text und TTS werden dabei vollstaendig vorgerendert, bleiben
aber bis zum autoritativen Deboarding-Cue fuer alle Playback-Clients gesperrt.
Erst dieses Missionsgate gibt den vorbereiteten Job frei. Touchdowns ausserhalb
des Zielradius sowie nicht migrierte Sonderprofile erzeugen keinen Preload.
Stable bleibt unveraendert auf v356; das EFB-Community-Paket bleibt auf 0.4.11
und der unveraenderte Host nutzt weiterhin Assetrevision 38101.

### EFB 0.4.12 Alpha

EFB 0.4.12 ist als unveraenderliches Alpha-Archiv `efb-app-v0.4.12`
veroeffentlicht. Der Fix setzt nach einem Innen-/Außenansichtswechsel vor der
erneuten Aktivierung den iframe-Startzustand zurueck, sodass ein frischer
Tracker-Host-Kanal aufgebaut wird und der Cockpit-EFB nicht schwarz bleibt.
Der mit MSFS-2024-SDK 1.7.2 erzeugte Kandidat wurde im Simulator mit
Alpha-Tracker v385 abgenommen. Stable bleibt bewusst auf 0.4.11, bis die
Alpha-Promotion freigegeben ist.

### Explizites Backlog nach dem APT-Mehrinstanznachweis

- **Debrief-Oberflaeche:** Das bestehende App-Debrief bleibt erhalten. Eine
  App-identische Darstellung im EFB/Toolbar-Panel, terminales Wiedereroeffnen
  und die Mehrinstanz-Synchronisierung des geschlossenen Runs werden als
  eigener Schritt umgesetzt; sie sind nicht Teil dieser Lueckenschliessung.
- **Flightlog-Ausbau:** Der Tracker schreibt Rohtelemetrie weiterhin lokal als
  append-only JSONL und erzeugt eine kompakte Summary. Explorer, Export,
  Langzeitverwaltung sowie das endgueltige komprimierte Cloudmodell werden
  spaeter separat umgesetzt. Rohpunkte sollen nicht wieder in den Browser-
  `localStorage` wandern.

## Aktueller EFB-Kanalstand

Am 20.08.2026 wurde der vereinfachte erste Execution-Ansatz als nicht
autoritaetsreif eingestuft. Der App-Code bleibt die aktive Referenz. Der
gemeinsame `mission-manifest-core.js` fuehrt dieselben Load-, Unload-, Reload-,
Drop-, Reset-, Passenger- und Signaturtransitionen aus und wird durch einen
Differentialtest direkt gegen die noch ausfuehrbaren App-Fallbackfunktionen
geprueft. Der Execution-Core behaelt Replay, Persistenz und Shadow-Vergleich.
Der damalige v375-Stand meldete deshalb `TRACKER_AUTHORITY_READY=false`; erst
der oben beschriebene v376-Kandidat oeffnet das Gate nach der vollstaendigen
gemeinsamen Extraktion fuer den ausdruecklichen Alpha-Feldtest.
Die App-Startfolge wurde bereits auf die getrennten Schritte `prepare_mission`
und `start_boarding` korrigiert. Der gemeinsame `mission-start-core.js`
sichert jetzt zusaetzlich die App-Reihenfolge fuer Manifest-/Signaturgate,
Payload-Finalisierung und Start-ready-Promotion. Der Tracker-Reducer trennt
Boarding-Szene, Boarding-Voice und Payload in drei echte ACK-Grenzen und kann
weder Szenen- noch Load-Intent als Abkuerzung nach `boarded` verwenden.
`mission-payload-core.js` ist inzwischen aus dem wirklichen App-Planer
extrahiert und wird von App und Tracker gemeinsam fuer Standardstationen und
PA-24 verwendet. Der Tracker fuehrt auch die bisherigen SimConnect-Schreib-,
Reassert- und Stabilitaetspruefungen aus. Plan, Readback, Override und der aus
dem App-Text extrahierte Status werden nun begrenzt im Execution-State
persistiert und aus derselben Trackerrevision in App und EFB projiziert. Der
Abort-/Reset-Rueckbau nutzt nun ebenfalls exakt die App-Reihenfolge, persistiert
die erste Baseline privat vor dem Sim-Schreibversuch und bleibt ueber einen
Tracker-Neustart retrybar. Auch laufende Load-, Reload-, Unload-, Drop- und
Pax-Transitionen verwenden nun denselben Planer, dieselbe 500-ms-/2-s-
Single-Flight-Queue und dieselben Readbackregeln. Der lokale Payload-Block ist
damit implementiert und lokal differential abgesichert. Payload bleibt Teil
des noch offenen realen APT-Gesamtnachweises, blockiert aber nicht mehr das
dreifach geschuetzte v376-Alpha-Feldgate.
Der Boarding-Voice-Schnitt verwendet bereits
denselben App-Fallbacktext, dieselbe Textvalidierung, Sprecher-/Modellrotation
und bei PAX dieselbe deterministische Cue-Auswahl. Der Tracker persistiert
Text und Audio ohne Key oder Prompt, dedupliziert ueber die Effekt-ID und
laesst Cue plus TTS von genau einer ausgewaehlten Cockpit-Instanz abspielen.
Farewell und Deboarding verwenden lokal dieselbe zentrale Lease und die
App-Reihenfolge aus Cue, Abschied, Continue, Handoff, Pax-Commit und Close.
Der Standard-APT-Farewell wird aus tracker-eigenem App-identischem
Flight-/Wetter-/Cargo-Kontext erzeugt; Sondermissionen brechen bewusst
geschlossen ab. Standard-APT-Farewell und -Deboarding sind lokal parity-ready;
der reale Voice-Lease-/Mehrinstanznachweis und die getrennte Migration der
Sonderpfade bleiben offen.
Die Farewell-Text- und TTS-Erzeugung wird fuer Tracker-Authority bereits beim
bestaetigten Ziel-Touchdown angestossen. Der vorbereitete Voice-Job bleibt bis
zum autoritativen Deboarding-Cue aus der Playback-Auswahl ausgeblendet; erst
dieses Gate gibt ihn zur Wiedergabe frei. Der Web-Authority-Pfad behaelt seinen
bereits vorhandenen Touchdown-Preload unveraendert bei.

Der Standard-APT-UI-Schnitt ist lokal einen Schritt weiter: Neben den bereits
charakterisierten Kartenbannern liefert `mission-apt-ui-core.js` nun ein
vollstaendigeres `app-cargo-dialog-v1` fuer Load und Unload. Der EFB verwendet
daraus dieselbe Frachtgutlistenstruktur, Item-/PAX-Texte, Signaturfolge,
Primaer-/Sekundaeraktion, Summen, Sperrerklaerung und Payload-Ergebnisanzeige
wie die App. Eine ausfuehrbare Charakterisierung vergleicht dieses Modell mit
der echten `_missionCargoRenderDialog()`-Funktion in sechs kritischen
Zustaenden. Semantisch gleiche Polls bleiben durch die Markup-Signatur ohne
DOM-Neuaufbau. Bordbuch-Start-/Landeeintraege und der
Austausch bald ablaufender Ausruestung laufen nun ueber denselben Manifest-
Core wie die App. Die 1,6-sekuendige Schreibanimation wird aus dem
autoritativen Signaturzeitpunkt in App und EFB gespiegelt; sie ist ein reiner
UI-Effekt, waehrend Boarding, Deboarding und SimObject-Bewegungen weiterhin
ausschliesslich als Tracker-Effekte im Simulator laufen. Reine Fracht-Pickups
koennen inklusive profilabhaengiger App-Texte autoritativ abgeschlossen werden. Ein tracker-eigener Fuenf-
Sekunden-Read projiziert ausserdem die vollstaendige, aber begrenzte Weight-&-
Balance-Zusammenfassung in beide Clients. Die Standard-APT-UI ist damit lokal
parity-ready; Passenger-Pickup gehoert zum weiterhin gesperrten Bush/Pickup-
Strang, und der reale App-/EFB-Mehrinstanzlauf fehlt. Der Standard-APT-
Compliance-Pfad ist lokal
aus dem App-Code extrahiert, ueber fuenf ausfuehrbare Differentialvarianten
gegen dessen unveraenderte Fallbacks abgesichert und in beiden Oberflaechen
projiziert. Force, Reload, genau eine Sanktion und Mehrinstanzbetrieb bleiben
als reale Feldnachweise des v376-Kandidaten offen.

Tracker v375 / Host 0.7.1 liefert die revisionsgebundene Mission-Control-
Bedienung und Cargo-Projektion. Alle veraenderlichen CSS- und JavaScript-
Dateien dieses tracker-gehosteten Hosts verwenden Revision 37501. Das
installierte EFB-Community-Paket bleibt unveraendert auf 0.4.11; ein neuer
SDK-Build ist fuer diesen Host-Test nicht erforderlich. Der freigegebene
v360-Host bleibt auf Revision 36001.
Der erste reale v370-Starttest zeigte einen asymmetrischen App-Transportfilter:
`mission_execution_authority_prepare` wurde erfolgreich vom Tracker bestaetigt,
das ACK aber vom sendenden Browser als fremd verworfen. Der v371-Folgefix
klassifiziert Prepare, Commit und Rollback wie die vorhandenen Authority- und
Snapshot-Befehle als lokal gesendetes Missionsprotokoll. Der EFB-Host zeigt bei
einem aktiven Tracker-Snapshot zusaetzlich einen kompakten Missionsbanner mit
Phase, Aufgabe und Controllerstatus. Der Banner oeffnet nur den gemeinsamen
Mission-Drawer und ist kein Ownership- oder Uebernahmebanner.
Das obere Werkzeugmenue wird beim Oeffnen direkt ueber der Kartenoberflaeche
gerendert, sodass sein E6B-Eintrag nicht mehr von der E6B-Eingabeflaeche
abgefangen wird. Das EFB-Community-Paket bleibt auf 0.4.11; fuer diesen
tracker-gehosteten Fix ist kein neuer SDK-Build erforderlich.

Der freigegebene Folgefix Tracker v372 / Host 0.6.8 verwendet Assetrevision
37201 und reagiert auf den ersten vollstaendigeren v371-Feldlauf. MSFS setzte
beim geoeffneten Cockpit-EFB `DialogMode=1`; die Missions-Telemetrie behandelte
das bislang wie einen echten SimStop und blieb deshalb trotz Flug auf
`active/departure`. v372 trennt den UI-Dialogzustand von der Missionssperre:
echte Pause und `SimStop` bleiben fail-closed, ein geoeffnetes EFB unterbricht
Airborne-, Touchdown- und Ground-Still-Erkennung nicht. Verwerfungen werden
rate-limitiert als `MISSION_EXECUTION_TELEMETRY_IGNORED` auch in den
automatischen Missionstest geschrieben. Der bisherige kompakte Statusstreifen
wird durch das vorhandene App-Kartenbanner ersetzt, das nur bei einer konkret
freigegebenen Aktion erscheint. Die Frachtgutliste liegt als eigener
Verlade-Manager ausserhalb des Seitendrawers; Manifestbezeichnungen und
autoritativ erlaubte Aktionen kommen aus demselben Tracker-Snapshot. Auch die
Web-App prueft vor Cargo-/PAX-Intents die aktuelle `allowedActions`-Liste und
zeigt eine lokale Warteerklaerung statt eines erwartbaren Tracker-Fehlers.
Reducer, Radien, Briefing, Missionsvertrag und Szeneneffekte bleiben
unveraendert. Nur Alpha zeigt auf v372; Stable bleibt auf v356.

Der in v374 enthaltene Recovery-Stand Tracker v373 verwendet
Host-Assetrevision 37301 und ergaenzt einen expliziten Recovery-Abbruch fuer
autoritative APT-Laeufe. App und EFB senden `abort_mission` nach Bestaetigung
mit exakter Run-Revision. Der Tracker bereinigt zuerst die zugehoerigen
SimObjects und gibt den Lauf erst danach als `aborted` frei; eine fehlgeschlagene
Bereinigung laesst die Authority aktiv. Browser-Instanzen verwerfen danach nur
den passenden lokalen Missions-/Cloudstand, erzeugen kein Abschluss-Debrief
und senden keinen alten Web-Release. Clear, Mission Reset und
Missionsersetzung verwenden bei Tracker-Authority denselben Pfad. Der
Verlade-Manager erklaert nicht freigegebene Flugphasen und deaktiviert die
betroffenen Item-, Signatur- und Abschlussaktionen. Reducer, Radien,
Briefing, Manifestregeln und normale Close-Logik bleiben unveraendert;
`reset_mission` bleibt nicht migriert. v373 wurde nicht separat veroeffentlicht,
sondern in v374 uebernommen; Stable bleibt auf v356.

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

Der als Alpha ausgerollte Tracker v374 / Host 0.7.0 verwendet Assetrevision
37401. Er korrigiert den neuen Feldbefund, bei dem MSFS waehrend eines echten
Flugs eine Pause-SimVar dauerhaft auf `1` liess: Sobald `Pause`/`Pause_EX1`
einen expliziten Zustand geliefert haben, gewinnt deren `OFF` gegen diese
widerspruechliche SimVar. Dadurch koennen Airborne, Touchdown und Ground-Still
wieder bis zur Zielentladung fortschreiten. Die ignorierte Telemetrie loggt
dafuer zusaetzlich beide Roh-SimVars und die Eventflags.

Eine geplante APT-Mission erhaelt beim normalen App-Cloudsave additiv einen
begrenzten Tracker-Seed mit demselben Manifest und demselben bereits
existierenden Szenen-Effektplan. Nur Alpha plus APT-Execution-Gate liest ihn.
Liegt kein aktiver Run vor, zeigt das EFB `Mission beginnen`; der Tracker legt
den Run mit dem vorhandenen Zwei-Phasen-Handoff an und fuehrt direkt
`prepare_mission` aus. App-Instanzen restaurieren einen solchen
Tracker-Execution-Run automatisch als Beobachter, ohne Runtime-Owner-Wechsel.
Kartenbanner und beide Verlade-Manager werden ausschliesslich aus der aktuellen
Tracker-Revision abgeleitet. Der letzte lokale Cargo-Toggle, der unter
Tracker-Authority noch nur den App-Clone aenderte, ist entfernt. Stable und
eine Alpha ohne APT-Gate laden weder Cloud-Seed noch schreibende Aktionen.

Tracker v375 / Host 0.7.1 uebernimmt fuer den autoritativen Lauf die bereits
in der App geltenden Manifestregeln: Fracht kann vor der Bestaetigung wieder
ausgeladen beziehungsweise am Ziel erneut geladen werden, jede Aenderung
loescht die passende Unterschrift, und `Zurueck zur Liste` ist in App und EFB
ein revisionsgebundener Tracker-Intent. Passagiere bleiben szenengebunden;
solange ein Deboarding-Effekt offen ist, wird kein zweiter erzeugt. Die lokalen
Pickup-/Unload-Buchhaltungseffekte werden im Tracker direkt quittiert, damit
sie den FIFO-Effect-Runner und den Missionsabschluss nicht blockieren.
Entlade-Unterschrift und Entladebestaetigung sind harte Core-Gates vor Close.
Semantisch unveraenderte Polls bauen weder EFB-Verladefenster noch App-
Projektion neu auf. Nach Annahme einer Mission wird der geplante Cloud-Seed
gezielt sofort gespeichert, damit `Mission beginnen` im EFB nicht auf einen
spaeteren App-Save warten muss. Missionsradien, Briefings und Effektplaene
bleiben unveraendert; EFB 0.4.11 muss nicht neu gebaut werden.

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

Der vollstaendige Ziel-, Paritaets- und Feature-Gate-Vertrag steht in
`docs/Mission Runtime Authority Contract.md`. Fuer alle weiteren APT-Arbeiten
gilt damit verbindlich: Die bestehende App ist die Verhaltensreferenz; der
Tracker darf ihre Logik nicht angenaehert neu implementieren. Pro Run ist
entweder die vollstaendige App-Ausfuehrung oder nach atomarem Commit die
vollstaendige Tracker-Ausfuehrung aktiv.

Die Tracker-Desktop-App speichert den Opt-in fuer die experimentelle
APT-Missionsausfuehrung standardmaessig ausgeschaltet in ihren lokalen
Einstellungen. Sie reicht `VFR_MULTITOOL_APT_EXECUTION=1` ausschliesslich an
einen Alpha-Tracker weiter und setzt fuer Stable beziehungsweise bei
ausgeschaltetem Schalter explizit `0`. Eine moeglicherweise noch vorhandene
systemweite Testvariable kann Stable deshalb nicht versehentlich aktivieren.
Beim Umschalten wird eine laufende Engine kontrolliert neu gestartet.

1. Der Windows-Tracker wird schrittweise zur lokalen Ausfuehrungs- und
   Rechenebene. SimConnect, Telemetrie, Szenen, persistente Missionslaufzeit und
   spaeter die Missionsausfuehrung liegen dort.
2. EFB und Toolbar-Panel bleiben schlanke Darstellungen und senden
   Benutzerabsichten. Sie setzen niemals direkt Missionsphasen, Manifeststatus,
   Voice-Gates oder SimConnect-Werte.
3. Die Web-App bleibt fuer Missionserzeugung, V4-Semantik, Briefing, Contract,
   Profil und Cloud-Daten verantwortlich. Sie bleibt waehrend der Migration die
   Stable-Referenz.
4. Missionsregeln werden nicht aus Browserdateien in `tracker.js` kopiert. Sie
   werden zuerst als transport-, UI- und persistenzneutraler Kern extrahiert,
   den Web und Tracker mit denselben Tests ausfuehren koennen.
5. Pro Missionslauf gibt es genau eine schreibende Autoritaet. Web und Tracker
   duerfen nie gleichzeitig nach Last-write-wins denselben Zustand veraendern.
6. Der aktuelle experimentelle `mission-execution-core.js` ist ein
   Migrationsprototyp. Er gilt erst nach Golden-Master-Paritaet fuer Zustand,
   Manifest, UI-Modell, Effekte und Fehlerpfade als Ersatz der App-Logik.
7. Der EXE-Schalter waehlt keine Teilfunktionen aus. Alpha plus Opt-in erlaubt
   nur einen atomaren APT-Authority-Commit; ohne Commit bleibt der gesamte Run
   im bisherigen App-internen Ablauf.
8. Neue Funktionen sind additiv und werden ueber Capabilities ausgehandelt.
   Fehlt eine Capability, bleibt die Web-App Autoritaet und der betroffene
   Cockpit-Client zeigt einen begrenzten, erklaerten Fallback.
9. Alpha und Stable verwenden unveraenderliche Release-Artefakte. Ein getestetes
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
          gemeinsamer tracker-gehosteter Kartentisch
                     |                 |
                     v                 v
              MSFS-2024-EFB     MSFS-Toolbar-Panel

Web-App <---- Snapshots/Ereignisse ----> Tracker
           Beobachter/Fallback waehrend der Migration
```

Der Missionskern entscheidet aus einem alten Zustand und einem expliziten
Ereignis deterministisch den neuen Zustand. UI, Voice, Szenen und Transport
reagieren auf ausgegebene Effekte, besitzen aber keine versteckte eigene
State-Machine.

## Produktziel: Gemeinsame Cockpit-Oberflaeche

EFB und globales MSFS-Toolbar-Panel werden zwei duenne Hosts derselben
tracker-gehosteten Cockpit-Oberflaeche. Karte, Mission Control, Verlade-Manager,
Pax-Interaktion, Voice-Status, Checklisten und Werkzeuge werden nicht pro Host
dupliziert. Host-spezifisch bleiben nur Paketregistrierung, Fenster-Lifecycle,
Groessen-/Fokusbehandlung, Offline-Fallback und das Schliessen des jeweiligen
MSFS-Fensters.

Die Web-App bleibt fuer Missionserzeugung, Auswahl, Semantik, Briefing und
Annahme verantwortlich. Eine bereits angenommene und vorbereitete Mission soll
anschliessend wahlweise ueber Web-App, EFB oder Toolbar-Panel bedient werden
koennen. Zum verbindlichen Cockpit-Funktionsumfang gehoeren langfristig:

- Mission vorbereiten und ueber die universelle Startkette beginnen;
- den vom Missionskern erlaubten Ground-Action-Schritt ausfuehren und eine
  fachlich abgeschlossene Mission schliessen;
- einen laufenden Auftrag nur ueber einen getrennten, ausdruecklich
  bestaetigten Abort-/Reset-Pfad abbrechen;
- Missionsladung, Pickup, Unload und optionalen Bordbestand im zentralen
  Verlade-Manager bearbeiten, unterschreiben und bestaetigen;
- kontextuell erlaubte Pax-Aktionen wie Missionsstatus, Orientierung,
  Wohlbefinden, Wetter-/Ladungsfrage, Fundmeldung und profilspezifische
  Interaktionen ausloesen;
- Voice-Antworten und Missionsansagen anfordern, anzeigen und abspielen sowie
  Wiedergabezustand, Stopp/Stumm und erlaubte Wiederholung bedienen.

Keiner dieser Clients erhaelt freie Setter fuer Phase, Erfolg, Cargo-Status
oder Voice-Flags. Er zeigt `allowedActions` und `blockingReasons` aus dem
autoritativen Snapshot und sendet ausschliesslich versionierte Intents mit
erwarteter Revision. Start, Pickup, Unload, Farewell, Deboarding und Close
durchlaufen weiterhin exakt die Gates aus `docs/Mission Flow Reference.md`.

Bei gleichzeitig geoeffneter Web-App, EFB und Toolbar-Panel darf eine Ansage
nur einmal hoerbar werden. Der Tracker fuehrt deshalb langfristig die
gemeinsame Voice-/Effekt-Queue und vergibt pro Missionslauf genau einen aktiven
Audio-Playback-Owner. Die Clients zeigen denselben Text und Queue-Zustand;
welcher Prozess die Audiodaten erzeugt und ausgibt, wird hinter dem
versionierten Voice-Vertrag gekapselt. API-Keys und andere Zugangsdaten werden
nie an EFB oder Toolbar-Panel ausgeliefert.

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

### TP0 - Toolbar-Panel Plattform-Spike

Status: als Ziel festgelegt, noch nicht implementiert

Ein getrenntes, nicht fuer Stable bestimmtes Community-Package prueft zuerst
die reale MSFS-2024-Hostgrenze. Der Spike bleibt vollstaendig read-only und
laedt denselben tracker-gehosteten Kartentisch wie das EFB. Nachzuweisen sind:

- Registrierung und Sichtbarkeit als globales Toolbar-Panel;
- Laden von `http://127.0.0.1:49880/efb/v1/` im Coherent-Host;
- Maus, Touch, Wheel, Tastaturfokus, Pan/Zoom und Leaflet-Overlays;
- Resize, minimale Groesse, Abdocken, Oeffnen/Schliessen und erneutes Oeffnen;
- eindeutiger Host-/Session-Channel und korrekte `ready/live/error/close`-
  Nachrichten;
- Tracker-aus-Fallback ohne Reload-Schleife;
- keine Mutation von Mission, Cargo, Pax, Voice oder SimConnect.

Die oeffentliche MSFS-2024-SDK-Dokumentation beschreibt frei erweiterbare
Simulator-UI derzeit nicht als stabilen Add-on-Vertrag und markiert Teile des
Toolbar-Panel-Listeners als Work in Progress. Deshalb wird Paketregistrierung
und Distributionsfaehigkeit am installierten SDK und im Simulator nachgewiesen,
bevor ein Releasevertrag oder Desktop-Autoupdate aktiviert wird.

### TP1 - Gemeinsamer Cockpit-Host

Status: lokal implementiert; realer Gesamtnachweis ausstehend

Nach positivem TP0 wird `/efb/v1/` zu einem gemeinsamen Cockpit-View mit
explizitem `host=efb|toolbar`-Kontext. Der Kontext darf nur Chrome, Layout,
Input- und Close-Lifecycle beeinflussen. Daten, Mission Control, Werkzeuge und
fachliche Aktionen bleiben dieselben Quellen und Komponenten. EFB und Panel
verwenden getrennte zufaellige Client-/Window-Channels, aber keine getrennte
Missionswahrheit. Zwischen EFB und Panel gibt es kein „Mission hierher
uebernehmen“-Banner. Beide bleiben parallel synchron; Konflikte werden durch
`commandId`, erwartete Revision und den anschliessenden autoritativen Snapshot
aufgeloest. Der bestehende Uebergabedialog bleibt auf einen echten
Web-Runtime-Owner-Wechsel zwischen Browsern/Geraeten begrenzt.

### TP2 - Mission Start, Abschluss und Abbruch

Status: geplant; setzt E2 bis E5 und Tracker-Authority fuer das jeweilige
Rezept voraus

Die Cockpit-Clients erhalten zuerst die universellen Missionsaktionen:

- `prepare_mission`, danach die vorhandenen Boarding-/Load-Gates;
- `confirm_load` und `start_mission` nur bei passender Phase und Revision;
- `request_close` nur nach autoritativem `ready_to_close`;
- `abort_mission` beziehungsweise `reset_mission` nur getrennt vom normalen
  Abschluss, mit sichtbaren Folgen und ausdruecklicher Bestaetigung.

Ein Button darf nie mehrere fachliche Gates ueberspringen. Insbesondere ist
`start_mission` kein Shortcut um Boarding, Pflichtladung, Signatur,
Verladebestaetigung oder Scene-ACK herum.

### TP3 - Verlade-Manager und Pax-Interaktion

Status: geplant; setzt transportneutrale Cargo-/Manifest- und Pax-Actions voraus

Der zentrale Verlade-Manager wird als gemeinsamer View auf denselben
Manifestvertrag projiziert. Unterstuetzt werden `load`, `pickup`, `unload` und
`equipment`, Item-Aenderungen, getrennte Signatur-Scopes und die jeweilige
Bestaetigung. Der Tracker beziehungsweise Missionskern validiert jede Mutation
und wendet Payload nur ueber den bestehenden Cargo-/SimConnect-Adapter an.

Pax-Interaktion ist eine Allowlist aus `allowedActions`, keine frei aufrufbare
Sammlung von Voice-Funktionen. Allgemeine Aktionen und profilspezifische
Aktionen wie Fire-Watch-Meldungen oder Trainingsentscheidungen werden als
versionierte Intents modelliert. Sie duerfen nur den passenden Core-Event
ausloesen; Text, Voice und Szene bleiben daraus abgeleitete Effekte.

### TP4 - Gemeinsame Voice-Wiedergabe

Status: lokaler End-to-End-Schnitt im v364-/Desktop-1.6.3-Kandidaten
implementiert; reale Coherent-/Toolbar-In-Sim-Freigabe steht aus

Voice wird in transportneutrale Auswahl/Queue, Text-/Audio-Erzeugung und
Playback getrennt. EFB und Toolbar-Panel koennen erlaubte Ansagen anfordern,
den aktuellen Sprecher/Text sehen, Wiedergabe stoppen oder stummschalten und
eine vom Vertrag freigegebene letzte Ansage wiederholen. Der Tracker
dedupliziert per `effectId`, verwirft spaete Antworten nach End-Lock und stellt
sicher, dass genau ein Playback-Owner die Ansage ausgibt. Voice darf weiterhin
keine Missionsphase oder Erfolgskriterium bestimmen.

Der erste vertikale Schnitt speichert den aktiven Provider-Key
Windows-benutzergebunden mit Electron `safeStorage`/DPAPI, uebergibt ihn nur
ueber die lokale Tracker-`stdin`-Pipe und erzeugt deduplizierte TTS-Jobs im
Tracker. Die Loopback-API trennt Jobstatus, Audiostream und Playback-Lease. Die
Web-App verwendet Tracker-TTS zuerst und behaelt die bisherige Browser-TTS als
Fallback. Das gemeinsame Audio-Menue besitzt nun
`Audio auf diesem Geraet abspielen`. Web, EFB und spaeter Toolbar melden diese
Praeferenz in ihrer kurzlebigen Cockpit-Sitzung. EFB/Toolbar koennen die
aelteste fertige Ansage pollen, exklusiv leasen, direkt vom Tracker streamen
und nach erfolgreichem Ende abschliessen. Noch offen sind die fachliche
Voice-Aktionsprojektion ausserhalb der nun migrierten Boarding-Ansage,
Farewell-/End-Lock-Tests gegen den migrierten
Execution-Core, Remote-Audio ueber den Relay-Pfad und der reale
Coherent-/Toolbar-Playback-Test.

### TP5 - Getrennter Panel-Rollout

Status: geplant

Das Toolbar-Panel bleibt mindestens bis zum positiven SDK-, In-Sim-,
Lifecycle- und Schreibintent-Test ein getrennt versioniertes
Community-Package. Alpha und Stable referenzieren unveraenderliche Artefakte;
ein Panel-Fehler darf Installation oder Stable-Funktion des EFB nicht
beeintraechtigen. Der Tracker-Desktop-Manager darf Installation und Update erst
nach festgelegtem Paketvertrag anbieten.

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

Status: erster transportneutraler Kern lokal implementiert; produktive
Browser-Runtime bleibt unveraendert autoritativ

Der gemeinsame Kern `mission-execution-core.js` kapselt:

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
- `PICKUP_CONFIRMED`, `UNLOAD_CONFIRMED`, `FAREWELL_STARTED`, `FAREWELL_COMPLETED`
- `CARGO_STATE_CHANGED`, `COMPLIANCE_EVENT`, `CLOSE_REQUESTED`, `MISSION_CLOSED`

Die vorhandenen fachlichen Wahrheiten bleiben erhalten: Cargo- und
Manifestkriterien kommen aus `mission-cargo-core.js`; Voice erzaehlt den
Zustand, bestimmt ihn aber nicht; `sync.js` bleibt zunaechst Adapter und
Orchestrator. Eine Verhaltenaenderung ist in dieser Phase nicht vorgesehen.

Der lokale v364-Schnitt stellt den UMD-Kern in Browser und Node bereit. Er
projiziert den bestehenden Resume-v2-Snapshot in einen narrativfreien,
versionierten Execution-State, normalisiert Cargo und den untergeordneten
Compliance-Workflow und implementiert Event-Replay, Start-/Cargo-/Close-Gates,
`deriveView`, `allowedActions`, stabile `effectId`, Serialisierung und einen
kanonischen State-Hash. Der Browser schreibt diese Projektion nur additiv als
`execution` in das vorhandene Resume-Bundle. Er verwendet den Reducer noch
nicht, um die laufende Mission fortzuschalten; `mission-runtime-core.js`,
`mission-cargo-core.js`, `mission-compliance-core.js` und alle bisherigen
Seiteneffekte bleiben damit unveraendert.

### E3 - Tracker-Shadow-Modus

Status: seiteneffektfreier APT-Live-Event-Replay lokal implementiert

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

Tracker v365 ergaenzt den Snapshot-Shadow um
`ga.mission-execution-bundle.v1`: Der Browser fuehrt fuer normale APT-Laeufe
ein separates, persistentes Journal, leitet aus aufeinanderfolgenden
autoritativen Runtime-/Cargo-/Compliance-Snapshots semantische Ereignisse ab
und transportiert Initialzustand plus Ereignisse im Resume-v2-Bundle. Der
Tracker replayt exakt dieses Bundle mit demselben reinen Core, statt den
Browser-Endzustand zu uebernehmen. Zusaetzlich vergleicht er den Replay-
Endzustand semantisch mit der aktuellen Legacy-Projektion. Dadurch werden
sowohl Browser-/Node-Paritaetsfehler als auch fehlende Adapterereignisse
sichtbar.

Der Adapter synthetisiert bei ausgelassenen Zwischen-Snapshots nur die
notwendigen gueltigen Vorbedingungen, dedupliziert wiederholte Snapshots und
ueberlebt Reload sowie Geraeteuebergabe. Manifest-/Signaturaenderungen laufen
ueber `CARGO_STATE_CHANGED`; Airborne, Touchdown, Ground-Still,
Entladeabschluss, Compliance, Closing und der finale Authority-Release werden
als eigene Ereignisse abgebildet. Beim Release wird `MISSION_CLOSED` zusammen
mit dem letzten Replay-Bundle gespeichert und noch einmal unabhaengig im
Tracker verglichen. Ein neuer geplanter Lauf mit derselben `missionId` startet
ein frisches Journal.

`noop`, veraltete und konfliktbehaftete Snapshots veraendern den Shadow nicht.
Die Loopback-Projektion meldet nur `match|drift|unavailable`, Feldnamen,
Hashes und einen gehashten Event-Trace; Story, Labels, Tokens und
Effektpayloads bleiben aus Diagnose und Log heraus. `sideEffects=false` und
`executionAuthority=web` bleiben unveraendert; der Reducer kann weiterhin
keine Szene, Voice, Payload-Aenderung oder Missionsaktion ausfuehren.

Tracker v366 macht den Realtest fuer externe Tester automatisch. Jeder normale
APT-Lauf schreibt ohne Schalter in das separate, rotierte
`GA-APT-Missionstest.txt`: Session-/Kanalstand, jeden akzeptierten Checkpoint,
Phase, Eventfolge, Browser-/Tracker-Hash, Driftfelder und am terminalen Close
ein `APT_TEST_END parity=PASS|FAIL`. Ein frueher Drift bleibt im Laufsummary
erhalten. Story, sichtbare Cargo-/Pax-Texte, Zugangsdaten und Effekt-Payloads
werden nicht aufgenommen. Desktop 1.6.3 markiert die Datei ueber den Button
`APT-Testlog` direkt im Explorer. Der Tester muss damit nur Alpha v367 starten,
eine normale APT-Mission vollstaendig fliegen und diese eine Datei senden.

Der erste externe v366-Bericht enthielt vier Tracker-Sitzungen und erfolgreiche
zentrale Voice-Auftraege, aber keinen `APT_TEST_BEGIN`. Die Ursache liegt im
Web-Reconnect: Der Relay-Socket galt bereits als offen, bevor der erste
Tracker-Heartbeat `mission.authority.v1` gemeldet hatte. In diesem kurzen
Fenster konnte der Missionsstart die versionierte Acquire-Anfrage ueberspringen;
der 180-ms-Reconnect sendete anschliessend bereits einen Legacy-Lifecycle und
legte damit einen Authority-Lauf ohne Resume-/Replay-Bundle an.

Web-Cache `ga-dispatcher-v1681` wartet beim Start und Reconnect kurz auf den
Capability-Heartbeat, bindet einen bereits begonnenen Lauf nach spaeter
Erkennung automatisch und sendet direkt danach einen vollstaendigen
Authority-Snapshot. Solange die Aushandlung noch offen ist, behalten
Missionscommands bereits die stabile Browser-Owner-ID. Tracker v367 erweitert
das Testlog auf `ga.apt-mission-test-log.v2`: `APT_TEST_WAITING` macht einen
noch nicht beobachteten Lauf explizit, redigierte `MISSION_PROTOCOL_*`-Zeilen
zeigen Eingang, Ergebnis sowie Bundle-/Execution-/Replay-Vorhandensein, und
wiederholte Render-503-/Close-Ereignisse werden nur noch einmal pro Minute
zusammengefasst. Autoritaet, Seiteneffekte und Stable-Verhalten bleiben
unveraendert.

Der zweite externe Bericht mit v367 bestaetigte den korrigierten
Authority-Handshake: Acquire, 57 Snapshots, drei zentrale Voice-Ergebnisse und
Release wurden erfolgreich verarbeitet. Der normale APT-Lauf wurde im
Resume-Bundle jedoch als `adapter=poi execution=1 replay=0` klassifiziert. Die
Ursache war kein Missions- oder Briefingdrift, sondern die technische
Resume-Erkennung: `targetName` existiert auch bei APT, und der allgemeine
Passenger-Voice-Fortschritt liefert auch ausserhalb von POI immer ein leeres
Objekt.

Der v368-Kandidat priorisiert deshalb die expliziten, bereits persistierten
Missionsmerkmale aus Mission und Contract. `targetName` und ein bloss
vorhandenes leeres `poiProgress` sind keine POI-Beweise mehr; eindeutige
Sonderadapter und belastbare Legacy-Merkmale bleiben erhalten. Web-Cache
`ga-dispatcher-v1682` enthaelt denselben Fallback. Briefing, Passenger-Voice,
Cargo, Runtime-Gates und Web-Authority werden nicht veraendert.

Das automatische Log verwendet ab v368 das allgemeine Schema
`ga.mission-test-log.v3` und die Praefixe `MISSION_TEST_*`. Es beobachtet alle
Authority-Rezepte und schliesst einen Lauf erst nach erfolgreichem
Authority-Release ab. `event-replay` darf weiterhin ein echtes
`parity=PASS|FAIL` melden; `snapshot-shadow` meldet Transport und Shadow separat
mit `parity=NOT_APPLICABLE`. Dateiname und Desktop-1.6.3-Zugriff bleiben fuer
Tester kompatibel bei `GA-APT-Missionstest.txt` beziehungsweise `APT-Testlog`.

`tools/mission-log-replay-selftest.mjs` kann diese vorhandenen Testlogs nun
offline als reales Zeit- und Reihenfolgeprofil lesen. Der Parser prueft
Checkpointabdeckung, Revisionen, Phasen und Effektstaus. Ein heutiger
Standard-APT-Compliance-Tail laeuft anschliessend mit den aufgezeichneten
Touchdown-, Ground-Still-, Cargo-, Unload- und Close-Zeitankern durch den
aktuellen Execution-Core. Jede Transition wird zusaetzlich nach Serialisierung
neu geladen, doppelt eingespielt und identisch fuer App und EFB projiziert;
Simulator-, TTS- und Crewboard-Effekte bleiben Dry-Run. Da das redigierte Log
absichtlich keine Manifest-, Positions- oder Effektpayloads enthaelt, ersetzt
ein als synthetisch markierter kanonischer Fixture diese Daten. Eine im alten
Lauf nicht aufgezeichnete Kontrolle darf nur als `synthetic-force` gelten und
nicht als realer Compliance-Feldnachweis.
Der veroeffentlichte Windows-Build umfasst 48.277.654 Bytes mit SHA-256
`9db300c13488d7f18b97d2f1712f2d59d18608d61b99e01337536a0c18da8692`;
nur Alpha wird aktualisiert, Stable bleibt auf v356.

### E4 - Autoritaet kontrolliert an den Tracker uebergeben

Status: atomarer Zwei-Phasen-Untervertrag und App-Handoff im gegateten
v371-Alpha-Folgefix implementiert; realer Recovery-Test ausstehend

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

`mission-authority-core.js` fuehrt dafuer additiv `executionAuthority`,
Execution-Rezept, Execution-Revision, Execution-State-Hash und einen
persistenten vorbereiteten Handoff. `prepareExecutionAuthority()` akzeptiert
aktuell ausschliesslich einen noch nicht begonnenen normalen APT-Lauf mit
vollstaendigem Event-Replay, identischem Browser-/Tracker-Shadow, leerem
Legacy-Drift und exakt passender Run-Revision sowie Web- und Execution-Hash.
Ein zwischen Vorbereitung und Commit eintreffender Web-Snapshot oder ein
Owner-Wechsel verwirft die Vorbereitung.

`commitExecutionAuthority()` bleibt im normalen Trackerbetrieb deaktiviert.
Nur der Alpha-Kanal mit `VFR_MULTITOOL_APT_EXECUTION=1` aktiviert ihn und
bewirbt danach `mission.intent.v1`. Der v371-Webclient schreibt unmittelbar
vor Prepare noch einen exakten Snapshot und schaltet erst nach dem positiven
Commit auf die Tracker-Projektion um. Atomare Persistenz, blockierte
Web-Snapshots und ein sicherer Rollback vor dem ersten Execution-Event bleiben
automatisiert abgedeckt.

Nach einem lokal aktivierten Commit nimmt `applyExecutionEvent()` nur exakt
sequenzierte, idempotente Core-Events mit passender Authority-Revision,
Execution-Revision und Execution-State-Hash an. State, Replay-Bundle, Phase und
Hash werden gemeinsam persistiert; ein Dateischreibfehler setzt die gesamte
Transaktion im Speicher zurueck und liefert kein positives ACK. Deklarative
Effekte werden nur zurueckgegeben, noch nicht ausgefuehrt. Nach dem ersten
akzeptierten Event ist der einfache Zero-Event-Rollback gesperrt.

### E5 - Schreibende Cockpit-Intents

Status: APT-Adapter, App-/EFB-Controller und echte Szenenhandler im gegateten
Alpha-Pfad verdrahtet; v375 ergaenzt Cloud-Start, den korrigierten
Pause-/Cargo-Abgleich und die App-paritaetischen Manifestregeln, Standard
und Stable bleiben read-only

Der heutige offene GET-Loopback wird nicht einfach um ungeschuetzte POSTs
erweitert. Derselbe Vertrag bedient spaeter EFB und Toolbar-Panel.
Schreibzugriff benoetigt:

- eigene Capability, beispielsweise `mission.intent.v1`
- kurzlebige lokale Sitzung beziehungsweise Token
- Allowlist fachlicher Intents statt frei setzbarer Phasen
- `commandId`, erwartete Revision und Idempotenz
- Schema- und Zustandsvalidierung sowie Rate-Limits
- nachvollziehbare ACK-/Fehlerantworten

Beispiele sind `prepare_mission`, `set_manifest_item`, `sign_manifest`,
`clear_manifest_signature`,
`confirm_load`, `start_mission`, `confirm_pickup`, `confirm_unload`,
`request_pax_interaction`, `submit_compliance_evidence`, `request_close` und
`abort_mission`. Nicht erlaubte Aktionen werden vom Tracker mit einem
strukturierten Blockierungsgrund abgewiesen. Voice wird als abgeleiteter,
trackerinterner Effekt ausgelöst; der sichtbare, bestaetigungspflichtige
"Mission Reset" ist bis zur Migration einer eigenen Reset-Transaktion ein
Alias fuer `abort_mission`.

Der sendende Host (`web`, `efb`, `toolbar`) wird fuer Diagnose und
Playback-Koordination erfasst, verleiht aber keine eigene Autoritaet. Alle
Clients sehen nach einem ACK denselben neuen Snapshot. Veraltete, doppelte oder
parallel gesendete Intents werden ueber Revision und `commandId` abgelehnt oder
idempotent bestaetigt.

Der erste lokale E5-Schnitt liegt in
`ga-tracker-client/tracker-mission-execution-adapter.js`. Er liest nur einen
normalisierten, narrativfreien Execution-Snapshot aus dem Authority-Core und
uebersetzt APT-Aktionen in die bereits festgelegten Core-Events. Freie
Phasenwerte oder ein vom Client gelieferter Gesamtzustand werden nicht
angenommen. Implementiert und durch einen vollstaendigen Core-Test abgedeckt
sind `prepare_mission`, Cargo-Item laden/entladen, Manifest fuer Abflug/Ankunft
signieren, `confirm_load`, `start_mission`, `confirm_unload` und
`request_close`. Boarding- und Close-ACKs besitzen einen getrennten internen
Systemeingang und bleiben an ihre exakte Vorphase gebunden.

Passagier-Items bleiben bewusst nicht ueber `set_manifest_item` veraenderbar.
`request_pax_interaction { action: deboard }` erzeugt stattdessen den
deklarativen Effekt `scene.deboarding`; erst dessen positives Simulator-ACK
markiert die Ziel-PAX als entladen. `abort_mission` besitzt ab v373 einen
eigenen Recovery-Pfad mit Sim-Bereinigung und atomarer Authority-Freigabe.
Pickup, missionsgetriggerte Voice, Compliance und Reset antworten in dieser
Stufe weiterhin seiteneffektfrei mit `mission_intent_not_migrated`.

Der gleiche Adapter besitzt einen internen APT-Telemetrieeingang. Airborne
benoetigt zwei Sekunden zusammenhaengende Evidenz, Ground-Still drei Sekunden
bei maximal drei Knoten; Pause und Karten-/Menuezustand verwerfen die laufende
Zeitprobe. Der gemeinsame `mission-location-core.js` wertet dazu den
autoritativen `aptArrivalPlan`, den letzten Missionsroutenpunkt und die echte
Trackerposition aus. Er verwendet unveraendert die App-Grenzen von 0,16 NM am
Arrival-Anker, 0,35 NM am Flugplatz-Fallback und 1,2 NM am Missionsziel ohne
APT-Anker. Ein vom Aufrufer geliefertes `atDestination` wird ignoriert. Die
Web-App delegiert ihre bestehende Zielentscheidung an denselben Core und
behaelt nur fuer alte/fehlende Scriptstaende die bisherige identische
Fallback-Rechnung.

Diese drei Werte sind Defaults, kein Universalradius. Eine Mission kann sie
ueber das vollstaendige Schema `ga.mission-location-policy.apt.v1` innerhalb
enger Grenzen variieren: Arrival-Anker 0,05 bis 0,5 NM,
Flugplatz-Fallback 0,1 bis 1,0 NM und Missionsziel 0,25 bis 3,0 NM. Alle drei
Werte und das Schema muessen vorhanden sein; unversionierte, unvollstaendige
oder ausserhalb der Grenzen liegende Policies fallen komplett auf die Defaults
zurueck. POI, Survey und Sonderablaeufe erhalten spaeter eigene Zonenrezepte
mit Radius, Hoehenband, Geschwindigkeit und Dwell-Zeit. Sie verwenden nicht
einfach eine vergroesserte APT-Policy.

`tracker-mission-effect-runner.js` bildet lokal die naechste E5-Grenze. Er
liest nur vom Core erzeugte `requested`-Effekte, dispatcht sie ueber registrierte
Handler mit der deterministischen `effectId` als `commandId` und persistiert
den Abschluss als `EFFECT_ACKNOWLEDGED` im Execution-Replay. Die APT-Folgen
`scene.prepare -> BOARDING_STARTED`, `scene.boarding -> BOARDING_CONFIRMED`,
`scene.deboarding -> PAX_DEBOARDING_CONFIRMED` und
`mission.close_requested -> MISSION_CLOSED` werden erst nach positivem
Handler-Ergebnis angewendet. Ein bereits persistiertes ACK verhindert die
erneute Ausfuehrung. Ein beim Neustart nur als dispatcht, aber nicht bestaetigt
gespeicherter physischer Effekt wird fail-closed angehalten, statt ein
moeglicherweise bereits vorhandenes SimObject zu duplizieren. Der lokale
Gesamttest deckt Prepare, Boarding, Flug, Deboarding, Entladung, Close und
beide Recovery-Faelle ab.

Der lokale v369-Schnitt verbindet diese Effektgrenze erstmals mit den echten,
bereits vorhandenen Tracker-Szenenhandlern. Die App legt fuer ein APT-Rezept
einen versionierten `ga.mission-apt-effect-plan.v1` in dasselbe private
Resume-Bundle. Der Plan wird aus denselben Funktionen erzeugt, die auch der
heutige Web-Ablauf fuer `mission_scene_spawn` und
`mission_scene_boarding` verwendet. Der Tracker erfindet daher keine zweite
Objekt-, Cargo-, Personen- oder Laufwegentscheidung. Beim Dispatch ersetzt er
nur Basisposition und Heading durch die aktuelle SimConnect-Position sowie die
Command-ID durch die persistente `effectId`.

`tracker-mission-simulator-effects.js` validiert Rezept, Mission, Run,
Command-Typ, Szenen-ID und begrenzte Item-/Pfadlisten, bevor ein interner
Handler erreicht wird. `tracker.js` besitzt dafuer einen gesonderten
`dispatchExecutionCommand()`-Eingang, der nur Spawn und Boarding erlaubt,
keine Legacy-Authority-Revision vortaeuscht und das echte Simulator-ACK auch
ohne Relay-Verbindung an den Runner zurueckgibt. Erst `status=ok` setzt den
Core fort; `noop`, `busy`, `no_scene` und Fehler werden als fehlgeschlagener
Effekt persistiert.

`tracker-mission-execution-runtime.js` verbindet Intent-Adapter, Telemetrie,
Effect-Runner und Simulator-Bridge. Nach einem Szenen-ACK wird die Queue erneut
gepumpt, sodass Prepare und Boarding geordnet fortschalten. Airborne,
Touchdown und Ground-Still kommen direkt aus dem vorhandenen SimConnect-Poll
und bleiben von Relay-/Browser-Telemetrie unabhaengig. Prepare, Commit und
Rollback sind als bestehende, revisionsgebundene Authority-Befehle im
Tracker-Protokoll erreichbar. Nach persistiertem `MISSION_CLOSED` und leerer
Effect-Queue verschiebt der Tracker den Lauf atomar nach `lastRun`; erst dann
verschwindet die aktive Mission fuer alle Cockpit-Clients.

Die gesamte Runtime bleibt zweifach gesperrt: Sie wird nur im Alpha-Kanal und
nur mit `VFR_MULTITOOL_APT_EXECUTION=1` erstellt. Ohne beide Bedingungen
bleiben Manager-Commit, Cockpit-Intents und Simulator-Bridge inaktiv,
`executionAuthority=web` und `mission.intent.v1` unsichtbar.

Der v371-Kandidat schliesst die UI-Grenze fuer APT. Beim ersten
`prepare_mission` schreibt die Web-App einen letzten exakten Snapshot, fuehrt
Prepare und Commit aus und wird danach Beobachter. App und EFB senden nur noch
kurzlebig authentifizierte, revisionsgebundene Intents. Manifeststatus,
Signatur, Start-/Endphase und erlaubte Aktionen werden aus
`ga.mission-execution-control.v1` projiziert; eine zweite Ansicht kann damit
keinen veralteten lokalen Cargo-Stand weiterschreiben. Boarding und Deboarding
laufen als Tracker-Effekte und schalten PAX erst nach dem echten Szenen-ACK um.

Nach dem Commit blockiert der Tracker alte Web-Szenenbefehle. Physische
Effektdispatches werden vor dem Aufruf persistent markiert: Ein bereits
gespeichertes ACK wird ohne erneuten Simulatoraufruf wiedergegeben. Endete der
Tracker dagegen zwischen Dispatch und ACK, wird der Effekt nach dem Neustart
bewusst nicht automatisch wiederholt, sondern mit
`mission_effect_recovery_confirmation_required` angehalten. Das verhindert
doppelte SimObjects, bis ein realer Recovery-Test und ein expliziter
Abgleichspfad vorliegen.

Ein geschlossener Lauf bleibt als begrenztes `lastExecution` sichtbar. EFB
meldet danach keine aktive Mission; die Web-App uebernimmt denselben Run genau
einmal in ihr bestehendes Debrief und raeumt ihn erst beim Schliessen des
Debriefs lokal auf. Noch nicht Teil dieser Stufe sind die zentrale
Sim-Payload-Verteilung, missionsgetriggerte Voice-Intents, POI-/Sonderrezepte
und ein Recovery-Dialog fuer den absichtlich angehaltenen Ambiguitaetsfall.

### E6 - Bord-/Behoerdenkontrolle als untergeordneter Workflow

Status: lokal implementiert, Feld- und Mehrinstanznachweis offen

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

`mission-compliance-domain-core.js` fuehrt nun Bewertung, Snapshot,
Nachbesserung, Ergebnistext, Sanktion und UI-Projektion transportneutral aus;
der vorhandene App-Pfad delegiert darauf. Der Tracker-Reducer fuehrt den
verschachtelten Workflow replaybar. Ground-Visit, beide Voice-Auftraege,
Crewboard-Sanktion und Abfahrt sind persistente Effekte. Der Feldtest muss noch
Force-Auswahl, Reload in jeder Phase, Szenenfallback, genau eine Audioinstanz,
idempotenten Crewboard-Eintrag und synchrones App-/EFB-Cargo belegen.

## Kompatibilitaets- und Rolloutregeln

- Stable Tracker v320 bleibt so lange gueltig, wie er den bestehenden
  Web-/Relay-Vertrag erfuellt. Alpha darf nicht pauschal den neuesten Tracker
  verlangen.
- Tracker ohne `mission.snapshot.v2` behaelt den aktuellen Web-Autoritaetsmodus.
- EFB und Toolbar-Panel blenden Aktionen aus oder deaktivieren sie mit
  Erklaerung, wenn eine Capability fehlt.
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
9. Gleichzeitiges EFB-/Panel-/Web-Opening ohne doppelte Mutation oder doppelte
   Voice-Wiedergabe.
10. Panel-Resize, Close/Reopen und Tracker-Neustart waehrend eines laufenden
    Intents ohne verlorenes ACK oder wiederholten Effekt.

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

- [x] Verbindlichen `Mission Runtime Authority Contract` festlegen: App als
      Verhaltensreferenz, genau eine Autoritaet pro Run und Alpha-Opt-in nur
      fuer einen atomaren vollstaendigen APT-Tracker-Pfad.
- [x] Die exakten Legacy-APT-Kartenbanner fuer Planned, Prepare, Boarding,
      Boarded, Enroute, Unload, End-ready, Deboarding und Debrief als ersten
      Golden-Charakterisierungstest sichern.
- [x] Explizite App-Recovery fuer einen aktiven Tracker-Run schliessen: Clear,
      Reset und Neue Mission warten auf Cleanup und `abort_mission`, leeren
      danach den lokalen Zustand und setzen die angeforderte Aktion ohne
      zweiten Klick fort. Ein reiner Seitenreload bleibt Restore/Reattach.
- [x] Ersten gemeinsamen `mission-manifest-core.js` extrahieren und die
      bestehende App ohne UI-/Ablaufaenderung daran anbinden: Passenger,
      Handoff-Lock, Signatur-Scope/-Invalidierung, Pickup-/Home-Delivery sowie
      APT-Load-/Unload-Pflichtgates laufen in Browser und Node durch dieselben
      Golden Tests.
- [x] Deterministische Manifesttransitionen fuer Load, Unload, Drop, Reload,
      Zurueck-auf-Pending sowie Sign/Unsign in denselben Core verschieben. Die
      Web-App committed diese Transitionen, behaelt aber ihre vorhandenen
      Payload-, Audio-, SimObject- und UI-Seiteneffekte; PAX fordert vorerst
      deklarativ die unveraenderte Boarding-/Deboarding-Sequenz an.
- [ ] Den APT-Referenzkatalog um Verlade-Manager, Manifesttransitionen,
      Signaturen, PAX, Boarding/Deboarding, Voice, Szeneneffekte, Fehler und
      Restore erweitern. Die erwarteten Ergebnisse werden aus der bestehenden
      App entnommen, nicht aus dem experimentellen Tracker-Core.
- [x] Den Standard-APT-Load-/Unload-Verlade-Manager aus der echten App-
      Renderfunktion charakterisieren: Frachtzeilen, PAX, Signatur,
      Signaturanimation, Confirm-/Close-Aktion, Summen und Tracker-Sperren
      laufen differentiell gegen `app-cargo-dialog-v1`.
- [ ] Danach den gemeinsamen APT-Domain- und Presentation-Core aus den
      bestehenden App-Pfaden extrahieren und zuerst bei weiterhin aktiver
      Web-Authority gegen alle Goldens laufen lassen.
- [ ] Erst nach unveraenderter App-Paritaet denselben Core hinter Alpha plus
      EXE-Schalter im Tracker ausfuehren. Der bisherige v375-Feldlauf bleibt
      Diagnose des Prototyps und ist keine Freigabegrundlage fuer weitere
      angenaeherte Einzelkorrekturen.
- [ ] TP0 als isoliertes read-only Toolbar-Panel-Paket gegen das installierte
      MSFS-2024-SDK aufbauen; keine bestehende EFB-Kanaldatei veraendern.
- [ ] TP0 im Simulator auf Registrierung, Loopback-iframe, Eingabe, Resize,
      Detach, Close/Reopen und Tracker-aus-Fallback pruefen.
- [ ] Nach positivem TP0 den gemeinsamen Host-Kontext `efb|toolbar` und den
      getrennten Panel-Paket-/Kanalvertrag festlegen.
- [ ] Vor TP2 den jetzt vorhandenen Execution-Core und Snapshot-Shadow um den
      gemeinsamen semantischen Eventstrom und recipe-weise Tracker-Authority
      erweitern; keine schreibenden Panel-Shortcuts auf die heutige
      Browser-Runtime bauen.
- [x] Atomaren APT-Authority-Handoff als vorbereiten/commit/rollback mit
      exakter Run-Revision, Web-/Execution-Hash, persistenter Recovery und
      standardmaessig gesperrtem Commit implementieren.
- [x] Fuer TP4 deduplizierte Voice-Jobs, begrenzten Audiocache und genau einen
      Playback-Owner mit Service-, Browserclient- und Loopback-Tests umsetzen.
- [x] TP4 lokal an den gemeinsamen EFB-/Toolbar-Host anbinden: geraetebezogene
      Audio-Praeferenz, Session-Heartbeat, `playback/next`, Lease, Stream und
      Abschlussmarker automatisiert pruefen.
- [ ] TP4-Playback, Audioformat, Close/Reopen und Tracker-aus-Fallback im EFB
      und nach TP0 auch im Toolbar-Panel real In-Sim pruefen.
- [x] `cockpit.session.v1` mit kurzlebigem Token, Rollen, Heartbeat,
      Audio-Praeferenz und oeffentlicher tokenfreier Projektion implementieren.
- [x] Revisionsgebundenen Intent-Gateway mit Allowlist, Idempotenz und
      Konflikt-ACK implementieren, aber bei Web-Authority ohne Side Effect
      sperren und `mission.intent.v1` noch nicht bewerben.
- [x] Gegateten APT-Handoff und gemeinsame App-/EFB-Bedienung auf
      revisionsgebundene Tracker-Intents umstellen; alte Web-Szenenbefehle nach
      Commit sperren, Cargo-/PAX-Projektion und terminales Debrief synchronisieren.
- [x] Expliziten revisionsgebundenen Tracker-Abbruch als Recovery-Pfad
      implementieren: Sim-Szenen zuerst bereinigen, Authority danach als
      `aborted` freigeben, App-/EFB-Stand ohne Debrief synchron leeren und
      gesperrte Cargo-Aktionen sichtbar erklaeren.
- [ ] Nach abgeschlossenem Core-Paritaetsgate einen neuen Kandidaten real mit
      App plus EFB in MSFS testen: Cloud-Start, Prepare, Boarding, Cargo aus
      beiden Instanzen, Start, Ziel-Ground-Still, Deboarding, Entladung, Close
      sowie finaler Debrief ohne doppeltes SimObject.
      Erster Versuch: Transport und zehn APT-Shadow-Checkpoints waren ohne
      Drift, der App-Filter verwarf jedoch das positive Prepare-ACK und liess
      dadurch weder Commit noch Boarding zu. Der lokale Filterfix und der neue
      EFB-Statusbanner sind automatisiert abgedeckt. Der zweite Versuch
      erreichte die Interaktionen, die Missions-Telemetrie blieb bei
      geoeffnetem EFB wegen `DialogMode=1` jedoch auf Abflug; dadurch lehnte
      der Tracker das Entladen mit `mission_manifest_unload_not_allowed` ab.
      v372 trennt DialogMode von SimStop, protokolliert verworfene Telemetrie,
      nutzt das App-artige Kartenbanner und den eigenstaendigen
      Verlade-Manager. Der reale Ablauf muss mit diesem Folge-Build wiederholt
      werden. Der abgebrochene Feldlauf hinterliess anschliessend einen nicht
      mehr loesbaren Tracker-Run; der lokale v373-Kandidat stellt dafuer den
      bestaetigten Recovery-Abbruch bereit. Der folgende Lauf belegte eine
      zweite Ursache: Trotz rund 450 kt meldete eine Pause-SimVar weiter `1`,
      sodass der Tracker alle Flug- und Landeuebergaenge verwarf. v374 nutzt
      das explizite Pause-Event als Zustandswahrheit, startet eine geplante
      Cloud-Mission direkt aus dem EFB und synchronisiert App-/EFB-Banner sowie
      Cargo nur noch aus der Tracker-Revision. Der anschliessende Feldlauf
      erreichte Boarding, Flug und Zielentladung, zeigte aber noch App-/EFB-
      Reloadflackern, nicht reversible Signaturen, mehrfach erzeugtes PAX-
      Deboarding und einen durch unbehandelte Unload-Effekte blockierten Close.
      v375 uebernahm dafuer Teile der App-Toggle-/Signaturregeln, deduplizierte
      PAX und quittierte lokale Cargo-Effekte. Die anschliessende Quellpruefung
      belegte jedoch, dass Payload, Boarding-Voice, Farewell/Deboarding und UI
      weiterhin nur angenaehert waren. Dieser Prototyp wird deshalb nicht
      erneut als autoritativer Feldtest verwendet; erst der vollstaendig
      extrahierte Folge-Core darf das Paritaetsgate wieder oeffnen.
- [ ] Ambiguitaetsfall Tracker-Neustart nach physischem Dispatch und vor ACK
      real provozieren; bestaetigen, dass der Lauf fail-closed bleibt, und erst
      danach einen expliziten Recovery-/Abgleichdialog entwerfen.
- [x] Sim-Payload-Verteilung einschliesslich inkrementeller Cargo-/Pax-Wirkung
      in die Tracker-Execution migrieren: Plan, Standard-/PA-24-Write/Readback,
      Ergebnisprojektion, 500-ms-/2-s-Single-Flight, Load/Reload/Unload/Drop,
      Pax-Boarding/Deboarding, persistente Ausruestungsbaseline, Reconnect und
      Rueckbau bei Abbruch/Ersetzen sind lokal automatisiert abgesichert.
- [x] `voice.boarding` aus der App exakt in den Tracker-Schnitt migrieren:
      Pickup-Unterdrueckung, Cargo-only-Loadmastertext, Training-Fallback,
      Sprecher-/Modellrotation, PAX-Cue vor TTS, 120-s-/Effekt-Deduplizierung,
      Neustartcache, exklusive Geraete-Lease und best-effort Freigabe sind
      lokal automatisiert abgesichert.
- [ ] Missionsgetriggerte Voice-Intents vollstaendig in die Tracker-Execution
      migrieren, bevor die APT-Authority ohne Alpha-Gate freigegeben wird.
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
- [x] Schnittgrenze fuer `mission-execution-core.js` anhand der vorhandenen
      Runtime-, Cargo- und Compliance-Vertraege festlegen und in Browser/Node
      mit identischem State-Hash absichern.
- [x] Seiteneffektfreien Tracker-Snapshot-Shadow hinter erfolgreich
      akzeptierten Authority-Snapshots implementieren.
- [x] Semantische Live-Events aus der Browser-Runtime an Web- und
      Tracker-Reducer spiegeln und Drift ueber komplette APT-Replays messen.

## Entscheidungsprotokoll

- 2026-08-21: Die obere Missionsleiste von App und tracker-gehostetem EFB
  verwendet jetzt denselben `ga.mission-toolbar.v1`-View. Der kontextuelle
  Start-/Boarding-/Pickup-/Entlade-/Ende-Button folgt dem bereits gemeinsamen
  Banner, der Verlade-Manager kann unabhaengig von einem weggeklickten Banner
  erneut geoeffnet werden und ein sichtbarer `Mission Reset` fuehrt nach
  Rueckfrage den revisionsgebundenen Tracker-Abbruch samt Simulator-Cleanup
  aus. Der EFB-Host blendet die Originalbuttons nicht mehr aus und aktualisiert
  Text, Sichtbarkeit und Sperrzustand nach jedem Mission-Snapshot und waehrend
  eines laufenden Intents. Ohne Tracker-Authority bleibt der unveraenderte
  App-Legacy-Pfad aktiv; ein eigenstaendiges MSFS-Toolbar-Panel ist davon
  weiterhin getrennt und noch nicht real implementiert.

- 2026-08-21: Der Standard-APT-Compliance-Workflow verwendet nun in App und
  Tracker denselben `mission-compliance-domain-core.js`. Ein direkter
  Differentialtest bestaetigt fuer gueltige Evidence, noch geladene Items,
  im Flug fehlende Ausruestung, Bordbuch-Nachbesserung sowie Verwarnung plus
  Behoerdeneintrag dieselben Snapshots, Regeln, Texte, UI-Sperren und
  Sanktionen wie die weiterhin ausfuehrbaren App-Fallbacks. Der Tracker fuehrt
  lokal die App-Reihenfolge Ground-Visit, Farewell, Kontrollansage, Evidence,
  Sanktion, Ergebnisansage, Abfahrt und Close aus. Replay-/Restart-, Voice-,
  Simulator-, UI- und Loopback-Suite sind gruen. Das Authority-Gate bleibt
  fuer den realen Force-/Reload-/Fallback-/Mehrinstanzlauf mit
  `TRACKER_AUTHORITY_READY=false` geschlossen; nichts wurde ausgerollt.

- 2026-08-21: Bordbuch und Ablauf-Equipment verwenden keine EFB-Sonderlogik
  mehr. `mission-manifest-core.js` plant Start-/Landeeintrag und Austausch mit
  denselben App-Gates; Metadatenwechsel lassen die Manifest-Unterschrift
  unveraendert. `mission-execution-core.js` projiziert nur die jeweils
  erlaubte Aktion, der Adapter committed sie revisionsgebunden. Reine Fracht-
  Pickups verwenden nun denselben Manifestzustand und koennen nach der
  Pickup-Signatur `return_leg` freigeben. Passenger-Pickup bleibt bis zur
  gemeinsamen Boarding-Szene bewusst deaktiviert. Der Tracker liest bei
  aktivem APT-Lauf alle fuenf Sekunden die aktuelle Sim-Payload und liefert
  App und EFB Gesamt-, Leer-, Fuel-, Pax-, Cargo-, Missions- und
  Stationsgewichte; rohe Assignments und Snapshots bleiben privat. Direkte
  App-Differenztests fuer Manifest, Cargo-UI und Payload sowie die neuen
  Core-/Adapter-/EFB-Tests sind gruen. Compliance bleibt wegen Ground-Visit,
  Voice, Evidence, Remediation und Crewboard-Sanktion fail-closed.
  `TRACKER_AUTHORITY_READY=false`; nichts wurde ausgerollt.

- 2026-08-21: Zwischenlandungen trennen nun Segment- und Missionsrecord. Nach
  fuenf Sekunden stabilem Halt wird das abgeschlossene Segment in den
  missionsweiten Record gemergt und nur der Segmentrecorder neu begonnen.
  Farewell verwendet weiterhin den eingefrorenen letzten Touchdown; das finale
  Debrief erhaelt dagegen Summe, Extremwerte und Stichproben aller Segmente.
  Rohtelemetrie liegt pro Run append-only als JSONL unter dem bestehenden
  Tracker-Dokumentordner, am Ende entsteht eine kompakte Summary fuer App-
  Debrief und vorhandenen Cloud-Sync. Damit waechst `localStorage` nicht mit
  Rohpunkten. Gleichzeitig liefert `mission-apt-ui-core.js` die aus der App
  charakterisierten APT-Banner- und Cargoentscheidungen an App und EFB.
  Planned, Prepare, Boarding, Boarded, Unload, End-ready, Deboarding und
  Debrief werden differentiell gegen den unveraenderten App-Legacy-Pfad
  geprueft. Der Authority-Gate bleibt bis zu Dialogfeld-, Animations- und
  realem Gesamtnachweis geschlossen; nichts wurde ausgerollt.

- 2026-08-21: Standard-APT-Farewell benoetigt fuer einen Close aus der
  tracker-gehosteten EFB kein veraltetes Handoff-Recipe mehr. Der gemeinsame
  `mission-flight-recorder-core.js` bildet die App-Regeln fuer Arming,
  Pause/Reconnect, Reposition, GPS-VS-Smoothing, Flugaggregate und Touchdown
  ab. Der Farewell-Record wird App-identisch am Touchdown eingefroren; nach
  fuenf Sekunden stabiler Zwischenlandung beginnt ein moeglicher Folgeabschnitt
  mit einem neuen Recorder. Der Tracker persistiert Record und letztes Wetter privat und
  neustartfest, ohne Authority-/Execution-Revision oder oeffentliches
  `updatedAt` zu veraendern. `mission-farewell-voice-core.js` kombiniert diese
  Werte mit dem beim Handoff privat uebernommenen App-Kontext fuer
  Passenger-Erfolg, direkten Failure-Text und Cargo-only. Cargo-Stress nutzt
  wie die App Record, Aggregate und den letzten Live-VS-Fallback; der geladene
  PAX wird fuer die Farewell-Auswertung nur projiziert entladen. Ein beim
  App-Close geliefertes aktuelles Recipe behaelt Vorrang. Bei
  Tracker-Authority ist die lokale App-Farewell-Vorbereitung gesperrt, damit
  kein zweiter TTS-Job entsteht. Der direkte Differentialtest fuehrt sowohl
  die originalen App-Promptfunktionen als auch den echten App-Authority-
  Context-Builder aus; Passenger-, Failure-, Cargo-, Wetter-, Flightrecord-
  und Cargo-Outcome-Ausgaben stimmen ueberein. Private Restart-,
  Handler-/Runtime- und breite Regressionstests sind gruen. Training, POI,
  Bush/Pickup und SAR-Heli liefern bis zu ihrer eigenen Migration ein
  deaktiviertes Recipe. `TRACKER_AUTHORITY_READY=false` und
  `farewell_deboarding_parity` bleiben bis zum realen APT-Gesamtlauf und den
  uebrigen Gates geschlossen. Nichts wurde ausgerollt.

- 2026-08-21: Der naechste APT-Schnitt bildet die App-Reihenfolge fuer
  Farewell und Deboarding nun explizit im Tracker ab: koordinierte Szene,
  Stage-Cue, Farewell-Voice, Continue, Handoff/ACK, Pax-Commit, inkrementeller
  Payload-Sync und erst danach Close beziehungsweise Compliance. Der neue
  `mission-farewell-voice-core.js` verpackt den unveraenderten Ausgang von
  `_farewellPreparedContext()` fuer Passenger-Erfolg, Failure-Fallback und
  Cargo-only. Der Tracker erzeugt einen deduplizierten `voice.farewell`-Job;
  der ausgewaehlte Audioclient spielt Deboarding-Cue und TTS auf derselben
  Lease. App/EFB reichen beim Close den aktuellen Flight-/Cargo-Kontext privat
  nach; er erscheint weder in Effects noch in der Mission-Control-Projektion.
  Szenenfehler schalten auf die gleiche best-effort Farewell-/Handoff-Fallback-
  Reihenfolge, Voice-Timeouts entfernen den Job vor einem moeglichen spaeten
  Playback. Core-, Handler-, Simulator-, Runtime-, Voice-Service- und direkte
  App-Recipe-Differentialtests sind lokal gruen. Der Authority-Gate und
  `farewell_deboarding_parity` bleiben dennoch geschlossen, bis der Tracker
  den dynamischen Flight-/Training-/Narrativkontext auch ohne eine
  vollstaendige App-Instanz selbst erzeugt und ein realer APT-Gesamtlauf die
  Sequenz bestaetigt. Nichts wurde ausgerollt.

- 2026-08-21: Der erste autoritative Voice-Effekt ist nicht angenaehert neu
  gebaut, sondern aus dem Boarding-Pfad der App extrahiert. Der gemeinsame
  `mission-boarding-voice-core.js` bildet Pickup-Suppression, Cargo-only-Pfad,
  dynamischen Prompt, Fallback- und Training-Validierung sowie die exakte
  Sprecher-/Modellrotation ab; ein Differentialtest fuehrt die behaltenen
  App-Fallbackfunktionen direkt dagegen aus. `voice.boarding` erzeugt im
  Tracker genau einen neustartfesten Job. Text, Sprecher und begrenzter
  Providerstatus werden autoritativ projiziert, der Key und der Prompt nie.
  Bei PAX waehlt derselbe Seed aus derselben Cue-Kandidatenreihenfolge und die
  gewinnende Cockpit-Instanz spielt Cue mit Gain `0.38` vor dem TTS-Stream auf
  einer Lease. Cargo-only erzeugt wie die App eine Ansage, aber keinen Pax-Cue.
  Tracker-, Provider-, Cue- oder Playbackfehler bleiben best effort und
  koennen den Missionsstart nicht verriegeln. Der lokale App-Cue ist nur bei
  Tracker-Authority gesperrt; mit ausgeschaltetem Gate bleibt der originale
  App-Ablauf aktiv. Core-, Service-, Handler-, Cockpit-, HTTP- und
  Differentialtests sind gruen. Nichts wurde ausgerollt; das Authority-Gate
  bleibt wegen Farewell/Deboarding, weiteren Voice-Arten, kanonischem UI und
  dem realen APT-Gesamtnachweis geschlossen.

- 2026-08-21: Der inkrementelle Payload-Pfad verwendet jetzt dieselben
  App-Regeln fuer Load, Reload, Unload, Airborne-Drop und automatisches
  Pax-Boarding/Deboarding. Jede fachliche Transition erzeugt einen
  persistierten `payload.sync_manifest_state`-Effekt; reine Signaturaktionen
  erzeugen keinen. Der Tracker entprellt wie die App 500 ms, erzwingt nach
  hoechstens zwei Sekunden einen Lauf und verarbeitet Write/Readback als
  Single-Flight auf den neuesten Manifeststand. Geerbte permanente Ausruestung
  wird vor dem Coalescing aus der privaten Baseline geloest und ihre Item-ID
  neustartfest gespeichert. SimConnect-Detach bricht eine alte Queue ab und
  gibt offene ACK-Leases fuer den sofortigen Reconnect-Dispatch frei. Die
  gezielten Core-/Runtime-/Recovery-Testreihen und fuenf direkte App-Fallback-
  Differenzszenarien waren gruen. Nichts wurde ausgerollt; der Authority-Gate
  bleibt wegen Voice, Farewell/Deboarding, kanonischem UI und realem
  APT-Gesamtnachweis geschlossen.

- 2026-08-21: Der Payload-Abort-/Reset-Rueckbau ist aus der vorhandenen
  App-Fallbackreihenfolge in `mission-payload-core.js` extrahiert. App und
  Tracker planen damit identisch Standard-Baseline, Baseline plus persistente
  Ausruestung, den Current-minus-Mission-Fallback bei geaendertem
  Stationslayout sowie PA-24-Sitze, Charactergewichte und Gepaeck. Der Tracker
  persistiert die erste gelesene Baseline atomar vor dem ersten
  Sim-Schreibversuch in `ga.mission-payload-recovery.v1`; dieser Datensatz wird
  weder in `activeRun` noch in Mission-/Execution-Control an App oder EFB
  projiziert und ueberlebt einen Tracker-Neustart. `abort_mission` stellt eine
  geschriebene Payload vor Szenencleanup und Authority-Freigabe wieder her und
  liest den Zustand erneut. Schreib-, Readback- oder Persistenzfehler sowie
  fehlendes SimConnect behalten den Run fuer einen Retry. Standard-,
  Persistent-, Stationswechsel-, PA-24-, Neustart-, Nicht-Publikations- und
  Fehlerretry-Tests sind lokal gruen. Das Authority-Gate bleibt geschlossen,
  weil inkrementelle Load-/Unload-/Pax-Payloadwirkungen, Voice,
  Farewell/Deboarding und das kanonische UI noch fehlen. Es wurde nichts
  ausgerollt.

- 2026-08-21: Das Ergebnis von `payload.sync_before_start` wird nicht mehr am
  Effect-Runner verworfen. Der Handler liefert einen begrenzten
  `ga.mission-payload-outcome.v1` mit Status, Override, Adapter, Fehler,
  Zielgewichten und zusammengefasster Readbackpruefung. Das nachfolgende
  `EFFECT_ACKNOWLEDGED` persistiert diesen Datensatz deterministisch im
  Execution-State; Roh-SimConnect-Snapshot, Assignments und einzelne
  Mismatchzeilen werden nicht publiziert. `ga.mission-execution-control.v1`
  projiziert denselben Zustand samt gemeinsamem App-Warntext an Web-App und
  EFB-Verlade-Manager. Auch der Legacy-Shadow kann den lokalen App-Ausgang im
  Runtime-Snapshot abbilden, ohne die bestehende App-Ausfuehrung zu ersetzen.
  Der Authority-Gate bleibt geschlossen: Als naechster Payload-Block fehlen
  der Rueckbau der gesetzten Sim-Zuladung bei Abbruch/Ersetzen und dessen
  Neustart-/Restore-Nachweis. Es wurde nichts ausgerollt.

- 2026-08-20: Die Sim-Payload-Verteilung verwendet nun einen gemeinsamen
  `mission-payload-core.js`, der direkt aus den App-Funktionen fuer
  Snapshotnormalisierung, Standardstationsverteilung, PA-24-Sitz-/Character-
  und Gepaeckplanung, Limits sowie Readbackvergleich extrahiert wurde. Die App
  ruft den Core auf und behaelt ihre bisherigen Funktionen als ausfuehrbaren
  Differential-Fallback. Im Tracker fuehrt ein injizierter SimConnect-Handler
  denselben Plan mit den App-Wartezeiten `900/2400 ms` beziehungsweise
  `350/650 ms`, dem `220 ms` PA-24-Reassert und genau einem Reassert-Versuch
  bei reinem Sitzstatusdrift aus. Planfehler, Schreibablehnung oder instabile
  Flugzeugwerte folgen weiterhin dem App-Vertrag "Tracker verbunden, Start
  mit Payload-Warnung erlaubt" und erzeugen keinen Hard-Lock. Das
  `payload_effect_parity`-Gate bleibt dennoch geschlossen, bis Plan,
  Readback, Override-/Fehlertext sowie Reset/Restore autoritativ persistiert
  und identisch an App, EFB und Panel projiziert werden. Der Legacy-App-Modus
  und die originale Fallbacklogik bleiben erhalten; es wurde nichts
  ausgerollt.

- 2026-08-20: Der naechste APT-Paritaetsschnitt extrahiert die bisherige
  App-Startentscheidung in `mission-start-core.js`. Die Web-App verwendet den
  Core fuer die unveraenderte Load-Confirm-Pruefreihenfolge, den bestehenden
  Payload-Override-Vertrag und `_missionCargoMaybePromoteStartReady`; ein
  Differentialtest fuehrt die Start-ready-Funktion mit gemeinsamem Core und
  ihrem App-Fallback aus. Der Tracker erzeugt auf `confirm_load` nur noch
  `LOAD_CONFIRMATION_REQUESTED` plus `payload.sync_before_start` und nach dem
  Szenen-ACK zunaechst `BOARDING_SCENE_CONFIRMED`. Bei PAX folgt getrennt
  `voice.boarding`; erst dessen ACK bestaetigt Boarding. Der Authority-Adapter
  akzeptiert diese internen Folgeevents nur bei wirklich offenem zugehoerigem
  Effekt. Payload-Fehler geben einen Retry frei, Voice-Fehler folgen dem
  best-effort-Verhalten der App und erzeugen keinen Hard-Lock. Der
  Effect-Runner blockiert einen unabhaengigen Payload-Effekt nicht hinter
  einem noch offenen Boarding-Szenen-ACK; damit bleibt die in der App erlaubte
  parallele Finalisierung erhalten. Der echte SimConnect-Payloadplan war zu
  diesem Zeitpunkt noch offen; der nachfolgende Eintrag dokumentiert seine
  gemeinsame Extraktion. `TRACKER_AUTHORITY_READY=false` bleibt unveraendert.

- 2026-08-20: Der Manifestteil ist nun direkt gegen die ausfuehrbaren
  App-Fallbackfunktionen differenziell getestet und wird vollstaendig, ohne
  reduzierte Cargo-Kopie, zwischen Tracker, App und EFB transportiert. Die
  automatische Prototyp-Abkuerzung `prepare -> boarding` wurde entfernt;
  `start_boarding` bildet wieder den zweiten sichtbaren App-Klick ab. Da die
  uebrigen Effektketten noch nicht gleichartig extrahiert sind, meldet der
  Execution-Core `TRACKER_AUTHORITY_READY=false`. Selbst Alpha plus Desktop-
  Opt-in bewirbt bis zum gruenen Payload-/Voice-/Farewell-/UI-Nachweis keine
  `mission.intent.v1`-Capability. Der unveraenderte Legacy-App-Pfad bleibt
  damit die einzige fachliche Autoritaet.

- 2026-08-20: Die APT-Migration wird auf exakte App-Paritaet zurueckgesetzt.
  Der neue `Mission Runtime Authority Contract` definiert den Tracker als
  einziges Hirn eines gegateten Runs und App, EFB sowie Toolbar-Panel als
  Interfaces desselben Zustands. Stable, Alpha ohne EXE-Opt-in, nicht
  freigegebene Rezepte und fehlgeschlagene Handoffs bleiben vollstaendig bei
  der bestehenden App-internen Ausfuehrung. Der aktuelle Execution-Core und
  seine Tracker-/EFB-Projektionen gelten als Migrationsprototyp, bis Zustand,
  Manifest, UI-Modell, Effekte, Voice und Recovery gegen Golden-Ausgaben der
  App identisch sind. `tools/apt-legacy-ui-characterization-selftest.mjs`
  sichert als ersten Referenzschnitt die bestehenden APT-Kartenbanner vom
  geplanten Start bis zum Debrief. Der reale v375-Prototyptest wird nicht durch
  weitere angenaeherte Feldfixes fortgesetzt, bevor Cargo, Pax,
  Boarding/Deboarding und Voice gleichartig charakterisiert und extrahiert
  sind. Clear, Reset, Neue-Mission-Erzeugung und die Annahme einer Folgemission
  warten bei Tracker-Authority auf den bestaetigten `abort_mission`-Pfad:
  Simulatorbereinigung und Authority-Freigabe laufen zuerst, danach wird der
  lokale App-Stand auch nach einem Reload erzwungen geleert und die
  angeforderte Aktion ohne zweiten Klick fortgesetzt. Ein normaler
  Seitenreload selbst bleibt ein Reattach und bricht keine Mission ab.

- 2026-08-18: Desktop 1.6.4 fuehrt den standardmaessig ausgeschalteten
  Schalter `Experimentelle APT-Tracker-Steuerung` ein. Er ist nur im
  Alpha-Kanal bedienbar, wird lokal in den Desktop-Einstellungen gespeichert
  und startet eine laufende Engine nach Aenderung kontrolliert neu. Der
  gestartete Prozess erhaelt fuer Alpha plus Opt-in
  `VFR_MULTITOOL_APT_EXECUTION=1`, andernfalls explizit `0`; damit kann auch
  eine alte systemweite Variable Stable nicht aktivieren. Die 46 Desktop-
  Tests sind gruen. Der lokale Windows-Installer umfasst 100.264.250 Bytes
  mit SHA-256
  `5577a2c8adfcb6e7044597e3489135ff5fe6b0146c38a0c7bda70f6be080ed34`;
  Installer, Blockmap und `latest.yml` werden unter dem unveraenderlichen
  Release `tracker-desktop-v1.6.4` veroeffentlicht und die Origin-Web-App
  verlinkt den Installer direkt. Der produktive Desktop-Autoupdatekanal bleibt
  auf 1.6.2; bestehende Installationen erhalten 1.6.4 daher nicht automatisch.

- 2026-08-18: Der v370-Alpha-Kandidat schaltet einen geplanten APT-Lauf erst
  nach letztem exakten Snapshot sowie positivem Prepare/Commit von Web- auf
  Tracker-Execution. Danach sind App und EFB gleichberechtigte Controller mit
  kurzlebiger Cockpit-Sitzung, `commandId` und erwarteter Revision; Status,
  erlaubte Aktionen, Manifest und Signatur stammen fuer alle Instanzen aus
  `ga.mission-execution-control.v1`. Alte Web-Szenenbefehle werden blockiert.
  Prepare/Boarding, PAX-Deboarding und Close laufen nur ueber deklarative
  Tracker-Effekte und echte Simulator-ACKs. Persistierte ACKs werden ohne
  erneuten Effekt wiedergegeben; ein Neustart zwischen Dispatch und ACK haelt
  fail-closed an. Der letzte geschlossene Lauf traegt einen begrenzten
  Abschlussmarker, sodass die App genau einmal ihr bestehendes Debrief oeffnet
  und EFB keine aktive Mission mehr meldet. 170 Missions-, Tracker-, EFB- und
  Recovery-Tests sind gruen. Offene Freigabepunkte bleiben der reale
  Mehrinstanz-/Neustarttest, zentrale Sim-Payload-Verteilung und
  missionsgetriggerte Voice-Intents. Der reproduzierbare Windows-Build umfasst
  48.396.976 Bytes mit SHA-256
  `df127e4884fb1dc67b7b713cd2450e77af563764ad13d659e63e0b95355fb57e`.
  Stable bleibt auf v356; das EFB-Community-Paket bleibt 0.4.11.

- 2026-08-18: Der erste v370-App-/EFB-Test erreichte den geplanten Zustand,
  zehn APT-Event-Replay-Shadow-Checkpoints blieben `MATCH`. Der Tracker nahm
  jedes `mission_execution_authority_prepare` an, die App registrierte diesen
  Befehlstyp jedoch nicht in ihrer lokalen ACK-Allowlist und protokollierte das
  eigene positive ACK als `foreign_tracker_ack_ignored`. Der gezielte Fix
  erweitert nur die Transportklassifizierung um `execution_authority`; Core,
  Mission, Manifest, Briefing und Effektregeln bleiben unveraendert. Der
  tracker-gehostete EFB-Client erhaelt ausserdem einen rein projektiven Banner,
  der Phase, aktuelle Aufgabe sowie `NUR LESEN`, `TRACKER LIVE` oder
  `AKTION BEREIT` anzeigt und den Mission-Drawer oeffnet.

- 2026-08-18: Tracker v371 / Host 0.6.7 ist als gezielter Alpha-Folgefix
  veroeffentlicht. Der Browser registriert jetzt
  `mission_execution_authority_prepare`, `commit` und `rollback` vor dem
  Broadcast-ACK lokal; der Zwei-Phasen-Handoff kann damit nach einem positiven
  Prepare bis zum Commit fortschreiten. Der EFB-Host zeigt den synchronen,
  rein projektiven Missionsbanner und verwendet Assetrevision 37101. Die
  Missions-/Cockpit-/EFB-Suite umfasst 108 gruene Tests, die unveraenderte
  Desktop-App 1.6.4 weitere 46. Der Windows-Build umfasst 48.402.930 Bytes mit
  SHA-256
  `e302c94546c029c1d14e184313d93429f747f1e256fd733408f1e62bb413b489`.
  Nur Alpha zeigt auf v371; Stable bleibt unveraendert auf v356 und das
  EFB-Community-Paket auf 0.4.11.

- 2026-08-18: Tracker v372 / Host 0.6.8 ist als gezielter Feldtest-Fix in
  Alpha veroeffentlicht. Die Tracker-Missionstelemetrie ignoriert den blossen
  `DialogMode` des geoeffneten EFB und sperrt weiterhin bei echter Pause oder
  `SimStop`. Ein rate-limitierter `MISSION_EXECUTION_TELEMETRY_IGNORED`-Eintrag
  landet auch im automatischen Missionstestlog. Das EFB nutzt nun den
  vorhandenen App-Banner als kontextuelle Kartenaktion und fuehrt die
  Frachtgutliste als eigenen, aus dem Missionsmenue erreichbaren Dialog. Die
  App sendet Cargo-/PAX-Intents nur noch, wenn der Tracker sie im aktuellen
  Stand erlaubt. APT-Core, Missionsradien, Briefings, Manifestregeln und
  Szeneneffekte wurden nicht veraendert. Assetrevision ist 37201. Der
  Windows-Build umfasst 48.421.316 Bytes mit SHA-256
  `fd8201dd8a6ddc73182c19e78fa42d9d67ca978804d477cc8e129701ad0d963d`.
  Nur Alpha zeigt auf v372; Stable bleibt auf v356 und das
  EFB-Community-Paket auf 0.4.11.

- 2026-08-18: Der lokale Tracker-v373-/Host-0.6.9-Kandidat schliesst den im
  v372-Feldlauf sichtbaren Recovery-Fehler. `abort_mission` validiert Sitzung,
  Mission, Run, Revision und `allowedActions`, raeumt bei verbundener Sim zuerst
  die Missions-/Szenenobjekte auf und persistiert den Lauf anschliessend als
  `aborted`. App-Clear, Mission Reset, Missionsersetzung und der destruktiv
  markierte EFB-Button verwenden denselben Pfad; andere Browserinstanzen
  leeren den passenden lokalen Zustand beim naechsten Snapshot ohne Debrief.
  App- und EFB-Verlade-Manager zeigen eine erklaerte Tracker-Sperre statt
  scheinbar wirkungsloser Eingaben. Der automatische Missionstest beendet den
  Lauf mit `completion=execution_aborted`. Assetrevision ist 37301. Dieser
  Stand ist mit 175 gruenen Tracker-/Missions-Tests geprueft. Der lokale
  Windows-Build umfasst 48.430.489 Bytes mit SHA-256
  `37dd0432401073c74caec9903424b7fab524891e83ac3a11f5fc73dffc1783bc`,
  ist aber noch nicht nach Alpha ausgerollt; die Kanaldateien bleiben
  unveraendert.

- 2026-08-18: Tracker v375 / Host 0.7.1 uebernimmt die bereits in der App
  geltenden reversiblen Manifest-/Signaturregeln in die Tracker-Execution.
  Deboarding-Intents werden waehrend eines offenen Szeneneffekts dedupliziert;
  reine Pickup-/Unload-Buchhaltungseffekte werden lokal quittiert und koennen
  Close nicht mehr blockieren. Arrival-Signatur und Entladebestaetigung sind
  harte Core-Gates. App und EFB aktualisieren Mission/Cargo nur bei einer
  semantischen Aenderung, und ein akzeptierter Missionsentwurf queued seinen
  geplanten Tracker-Cloud-Seed sofort nach dem Runtime-Reset. Host-
  Assetrevision ist 37501; EFB 0.4.11 bleibt unveraendert. Stable bleibt auf
  v356. 166 Tracker-/Missions-/EFB-Tests und vier Missions-Selbsttests laufen
  gruen. Der Windows-Build umfasst 48.466.443 Bytes mit SHA-256
  `7a422956d36deec2278f6507ea9f682fd30927a06845b57be47f939bfb416f5f`.
  Der unveraenderliche Build ist im Alpha-Kanal ausgerollt.

- 2026-08-18: Der lokale Tracker-v374-/Host-0.7.0-Kandidat korrigiert den
  Folge-Feldlauf. Ein ausdrueckliches `Pause/Pause_EX1=OFF` gewinnt nach der
  ersten Eventmeldung gegen fehlerhaft weiter gesetzte Pause-SimVars; die
  Missionsdetektoren erhalten dadurch Airborne, Touchdown und Ground-Still.
  Geplante APT-Missionen speichern additiv einen begrenzten Cloud-Seed mit
  Manifest und bestehendem Effektplan. Im gegateten Alpha-Modus kann das EFB
  daraus ohne vorherigen App-Start einen neuen Tracker-Run anlegen und direkt
  vorbereiten. Weitere Apps restaurieren diesen Run automatisch nur als
  Beobachter. App- und EFB-Banner sowie Cargo-Aktionen stammen aus derselben
  Tracker-Revision; ein verbliebener lokaler App-Cargo-Toggle wurde auf den
  Intentpfad umgestellt. Host-Assetrevision ist 37401. Stable und Alpha ohne
  `VFR_MULTITOOL_APT_EXECUTION=1` bleiben ohne diesen Cloud-Start read-only.
  146 relevante Tracker-/Missions-/EFB-Tests laufen gruen. Der lokale
  Windows-Build umfasst 48.460.239 Bytes mit SHA-256
  `de00206bd8a09f50e09482361997ed2ae3ecbc757b46303ed9ce057639c2c14d`.
  Der unveraenderliche Build ist im Alpha-Kanal ausgerollt; Stable bleibt auf
  v356 und das EFB-Community-Paket auf 0.4.11.

- 2026-08-18: Der lokale v369-Schnitt verbindet den APT-Effect-Runner mit den
  vorhandenen SimConnect-Szenenhandlern. Die App nimmt einen versionierten,
  aus ihren bestehenden Spawn-/Boarding-Buildern erzeugten Effektplan in das
  private Authority-Bundle auf; der Tracker validiert ihn und setzt nur die
  aktuelle Simposition sowie die persistente Effekt-ID ein. Spawn- und
  Boarding-ACKs schalten denselben Core fort, Fehler bleiben Fehler. Adapter,
  Telemetrie und Intent-Gateway sind in `tracker.js` verdrahtet, aber nur bei
  Alpha plus `VFR_MULTITOOL_APT_EXECUTION=1` aktiv. Standard, Stable und die
  normale Alpha bleiben Web-Authority und bewerben keine Intent-Capability.
  Eine automatische Uebergabe oder UI-Umschaltung ist bewusst noch nicht
  aktiv; vor der Alpha-Freigabe folgen In-Sim-Recoverytest und Umleitung der
  APT-Bedienaktionen auf den Tracker-Intent-Vertrag. Der lokale Windows-Build
  umfasst 48.377.315 Bytes mit SHA-256
  `37bd3d293d9439be8099df286d6115e01c3a65d462dded3f0c97eb66e53e3e5f`;
  nur der Tracker-Alpha-Kanal wird auf v369 gesetzt, Stable bleibt auf v356.

- 2026-08-18: Der unvollstaendige v368-Realbericht wird nach ausdruecklicher
  Freigabe als gueltiger Transport-/Snapshot-Shadow-Test gewertet. Tracker und
  Browser stimmen in 35 von 35 Checkpoints von `planned` bis
  `farewell_wait` ueberein; drei zentrale TTS-Jobs wurden erzeugt. Wegen des
  spaeten Missionsstarts und des Sim-Abbruchs sind Zonenzeit und terminaler
  Release nicht bewertet. Der Lauf blieb als `adapter=poi`, `replay=0` im
  `snapshot-shadow`; daraus wird keine Event-Replay-Paritaet abgeleitet.
  E4 bleibt deshalb beim ersten Implementierungsschritt hart an ein echtes,
  driftfreies APT-Event-Replay gebunden.

- 2026-08-18: E4 beginnt lokal mit einem atomaren Zwei-Phasen-Vertrag im
  bestehenden persistenten Authority-Run. Vorbereitung erfordert APT-Rezept,
  sicheren `planned`-Zustand, exakte Run-Revision, Web-State-Hash,
  Execution-State-Hash und uebereinstimmende Browser-/Tracker-Projektion.
  Neustart, falsche/stale Hashes, Snapshot-only, POI, bereits begonnener Lauf,
  Zwischen-Snapshot, standardmaessig gesperrter Commit sowie ein Zero-Event-
  Rollback sind automatisiert abgedeckt. Ein zusaetzlicher trackerinterner
  Event-Eingang nimmt nach lokal aktiviertem Commit nur die naechste exakte
  Eventsequenz an, bestaetigt Duplikate idempotent, persistiert Replay und State
  gemeinsam und blockiert danach den einfachen Rollback. Auch ein simulierter
  Persistenzfehler kann kein positives Handoff-ACK erzeugen. Der Produktions-
  Tracker ruft Commit und Event-Eingang noch nicht auf, bewirbt keine neue
  Capability und behaelt Web-Authority, Missionspfade und Seiteneffekte
  unveraendert.

- 2026-08-18: Der erste v366-Realbericht weist die fehlende APT-Mitfuehrung auf
  die Zeit zwischen Relay-Open und Tracker-Capability-Heartbeat zurueck. Die App
  konnte dort auf den Legacy-Pfad fallen; der fruehe Reconnect-Lifecycle legte
  dann einen Lauf ohne Execution-Replay an. Web-Cache `ga-dispatcher-v1681`
  wartet auf die Aushandlung, bindet spaet erkannte Authority automatisch und
  seedet sofort den vollstaendigen Snapshot. Tracker v367 protokolliert den
  redigierten Protokollweg und fasst die Render-503-Flut minutenweise zusammen.
  131 Tracker-/EFB-/Web-Core-Tests sowie Resume-, Authority-Handoff-, Ground-
  und Update-Selbsttests bestehen. Die v367-Windows-EXE umfasst 48.275.590
  Bytes mit SHA-256
  `893d8387aa584ef0eccbb28e7a113c36fbc3c8c530ea094b9531c37dddd6a57e`.
  Nur Alpha und Origin werden aktualisiert; Stable, EFB 0.4.11, Toolbar-Panel
  und Desktop-Installer 1.6.3 bleiben unveraendert.

- 2026-08-18: Tracker v366 aktiviert fuer alle normalen APT-Laeufe den
  automatischen, separaten Shadow-Realtest. `GA-APT-Missionstest.txt` erfasst
  jeden akzeptierten Checkpoint sowie ein ueber den gesamten Run klebendes
  PASS-/FAIL-Ergebnis, bleibt aber frei von Narrativ, sichtbaren Labels,
  Zugangsdaten und Effekt-Payloads. Desktop 1.6.3 bietet einen direkten
  Explorer-Button fuer diese Datei. Browser-Authority, bestehende
  Missions-/Cargo-/Voice-/Szenenpfade und der read-only Intent-Gateway bleiben
  unveraendert. 149 Tracker-/EFB-/Web-Core-Tests, 45 Desktop-Tests und der
  AWM-Audio-Selftest bestehen. Die v366-Windows-EXE umfasst 48.269.254 Bytes
  mit SHA-256
  `79bc7759b6fd183a849e1a89cffb409b0f9a42ff592031f090b61fbb0834aa23`.
  Der Desktop-1.6.3-Installer umfasst 100.263.558 Bytes mit SHA-256
  `32e32b0870ee4a28fb81c046f55ec10dc9fe0c32e1351467b266210be91573d3`.
  Installer, Blockmap und `latest.yml` sind unter dem unveraenderlichen Release
  `tracker-desktop-v1.6.3` veroeffentlicht und remote verifiziert. Die
  Origin-Web-App verlinkt den Installer direkt und weist darauf hin, dass
  Stable der Standard bleibt und Alpha fuer den Test ausdruecklich gewaehlt
  werden muss.
  Tracker v366 geht ausschliesslich in Alpha; Stable, EFB und Toolbar bleiben
  unveraendert. Der globale Desktop-Autoupdate-Kanal bleibt vorerst auf 1.6.2;
  es erfolgt daher kein automatischer Rollout an bestehende Installationen.

- 2026-08-18: Der lokale v365-Kandidat fuehrt fuer normale APT-Missionen ein
  persistentes, narrativfreies Shadow-Journal ein. Der Browser leitet aus den
  weiterhin allein autoritativen Legacy-Snapshots `PREPARE_REQUESTED`,
  Boarding-/Load-, Cargo-, Airborne-/Boden-, Unload-, Compliance-, Close- und
  Terminalereignisse ab. Browser und Tracker replayen dasselbe transportierte
  Execution-Bundle und vergleichen den Replay-Endzustand zusaetzlich mit der
  Legacy-Projektion. Skip-, Duplicate-, Reload-, Handoff-, gleiche-Missions-ID-
  und Terminal-Release-Faelle sind abgedeckt; der Replay-Hash nimmt an der
  Authority-Deduplizierung teil. Missionslogik, Cargo-Schreibpfad, Voice,
  Szenen und `mission.intent.v1` bleiben unveraendert unter Web-Authority. Der
  gemeinsame Lauf besteht mit 147 Tracker-/EFB-Tests inklusive Loopback, 45
  Desktop-Tests und dem AWM-Audio-Selftest. Die lokale v365-Windows-EXE umfasst
  48.255.926 Bytes mit SHA-256
  `a9443a959b58ea21bdfaccd2f4dec01e13ab2a5f616f01648d3b6345d94ef42a`;
  sie enthaelt den Execution-Core und die Event-Replay-Diagnostik als
  pkg-Ressourcen. Alpha-/Stable-, EFB- und Toolbar-Kanaele bleiben
  unveraendert; nur der Tracker-Alpha-Kanal zeigt auf das unveraenderliche
  Release v365. Stable, EFB und Toolbar bleiben unveraendert.

- 2026-08-18: Der lokale v364-Kandidat fuehrt
  `mission-execution-core.js` als gemeinsamen, DOM-/Transport-/Voice-freien
  Browser-/Node-Kern ein. Die heutige Browser-Runtime bleibt alleinige
  Execution-Authority und schreibt lediglich eine additive, narrativfreie
  Execution-Projektion in das bestehende Resume-v2-Bundle. Der Tracker rechnet
  diese Projektion nur nach erfolgreich akzeptierten Snapshots unabhaengig neu;
  Stale-/Conflict-/Noop-Updates werden ignoriert. Match oder Drift werden ohne
  Effektpayload, Story, Cargo-/Pax-Label oder Token unter Status und
  `mission.snapshot.v2` projiziert. Weder Reducer noch Shadow koennen Szene,
  Voice, Payload oder Close ausfuehren. APT-Replay, Browser-/Node-Paritaet,
  Start-/Manifest-/Compliance-/Close-Gates, Duplicate-Events, Recovery,
  Drift-Redaktion und die Abwaertskompatibilitaet alter Bundles sind lokal
  automatisiert abgedeckt. Der gemeinsame Lauf besteht mit 107 Tracker-/EFB-
  Tests, 45 Desktop-Tests und dem AWM-Audio-Selftest. Die lokale v364-Windows-
  EXE umfasst 48.249.734 Bytes mit SHA-256
  `69f828c5d5006b1a157b890c777ad34654f62d1ae19855ac6dc85b4dad872825`;
  der Build enthaelt den gemeinsamen Core nachweislich als pkg-Ressource.
  Alpha-/Stable-, EFB- und Toolbar-Kanaele bleiben unveraendert; v364 ist nicht
  veroeffentlicht.

- 2026-08-17: Der lokale v363-Kandidat registriert Web-App, EFB und den
  kuenftigen Toolbar-Host als getrennte kurzlebige Cockpit-Sitzungen. Die neue
  Audio-Option `Audio auf diesem Geraet abspielen` wird pro Instanz gespeichert
  und im Heartbeat projiziert. Nur aktivierte EFB-/Toolbar-Instanzen pollen
  fertige Tracker-Ansagen; die vorhandene Lease entscheidet bei mehreren
  Kandidaten eindeutig. Derselbe Schnitt legt Allowlist, Sitzungspruefung,
  `commandId`, Idempotenz und exakte Missionsrevision fuer spaetere Mission-
  Intents fest. Bei der weiterhin aktiven Web-Authority bleiben diese Intents
  mit `mission_intents_read_only` garantiert seiteneffektfrei und ihre
  Capability wird nicht beworben. Die alte Browser-Missionslogik wurde weder
  geloescht noch deaktiviert. Der tracker-gehostete Host verwendet lokal
  Assetrevision 36301 und View 7; kein EFB- oder Toolbar-Kanal wurde geaendert.

- 2026-08-17: Der lokale Tracker-v363-/Desktop-1.6.3-Kandidat implementiert den
  ersten zentralen Voice-Schnitt. Gemini- oder OpenAI-Key werden mit
  `safeStorage`/Windows DPAPI benutzergebunden verschluesselt und nur per lokaler
  Prozess-Pipe in die Engine gegeben. Der Tracker dedupliziert TTS-Auftraege per
  `effectId`, cached das Audio begrenzt und vergibt eine Playback-Lease an genau
  einen Client. Die Web-App nutzt diesen Pfad zuerst; bei fehlendem Tracker-Key
  oder nicht erreichbarer Loopback-API bleibt die bestehende Browser-TTS aktiv.
  Der Alpha-Kanal bleibt bis lokalem EXE-/Desktop-Build, Release und realem Test
  unveraendert auf v362 beziehungsweise Desktop 1.6.2. Der lokale v363-Build
  umfasst nach Voice-, Session- und Intent-Fundament 48.181.790 Bytes mit
  SHA-256
  `235dc700ffb6c8ab719b15d37612a0233b0a2bbf77d4f4430f7fe9193dfa05cc`;
  der Desktop-1.6.3-Windows-Directory-Build wurde ebenfalls erfolgreich
  paketiert. Beide sind noch nicht veroeffentlicht.

- 2026-08-17: EFB und Toolbar-Panel erhalten keinen gegenseitigen
  Master-/Slave- oder Mission-Handoff. Der Tracker ist im Zielbetrieb die
  einzige Execution-Authority; App, EFB und Panel sind parallele Controller.
  Der heutige `ownerClientId` bleibt bis zur recipe-weisen Tracker-Uebergabe
  ausschliesslich der schreibende Web-Runtime-Owner. Cockpit-Clients zeigen in
  dieser Zwischenstufe „Mission wird von der App ausgefuehrt“ und bleiben
  lesend, statt den Owner zu uebernehmen. Nach Tracker-Authority gewinnt bei
  parallelen Aktionen der erste Intent auf der erwarteten Revision; spaetere
  Intents erhalten den aktuellen Snapshot. Boarding, Signatur, Payload,
  Deboarding, Close und Voice werden als gemeinsame Operationen/Effekte
  gesperrt und nicht an ein Fenster gebunden.

- 2026-08-17: Ein globales MSFS-Toolbar-Panel wird neben dem EFB zum
  verbindlichen Cockpit-Client-Ziel. Beide Hosts verwenden denselben
  tracker-gehosteten Kartentisch. Der Zielumfang umfasst den kontrollierten
  Start und Abschluss angenommener Missionen, Abort/Reset als getrennten
  Bestaetigungspfad, den zentralen Verlade-Manager, kontextuelle Pax-
  Interaktionen und Voice-Wiedergabe. Alle Mutationen laufen als
  capability-gesteuerte, revisionsgebundene Intents gegen genau eine
  Tracker-/Missionsautoritaet. Eine gemeinsame Effekt-/Voice-Queue verhindert
  doppelte Ansagen bei gleichzeitig geoeffneter Web-App, EFB und Panel. Vor
  schreibenden Funktionen wird ein getrenntes read-only Community-Package im
  realen MSFS-2024-Coherent-/Toolbar-Host validiert.

- 2026-08-17: P4 schaltet Gruppenmissionen ausschliesslich in der Web-App frei.
  Charter, Private Outing und Sightseeing koennen bei ausreichenden
  Preset-Passagierplaetzen Paar, Familie, Freundesgruppe, Verein oder
  Business-Team ziehen. Party-Typ und exakter Count werden vor dem Writer
  festgelegt und bleiben in Story, Hauptpassagier-/Voice-Rolle, Contract,
  V4-Contract, Anzeige und Manifest identisch. Utility und Cargo erzeugen keine
  neuen Gruppen. Die Freigabe haengt additiv an der ausgehandelten
  `mission.scene.group.v1`-Capability; ohne sie sowie bei nur einem freien Sitz
  bleibt es bei einer Einzelperson. Tracker v362 Alpha und v356 Stable bleiben
  unveraendert.

- 2026-08-17: Der abschliessende reale Tracker-v362-Gruppentest wurde
  freigegeben. Gemeinsamer Tuer-Spawn, serieller Ausstieg im 2000-ms-Abstand
  und Laufwege zum Van beziehungsweise Bus funktionieren im Simulator. Die
  Abnahme der Produktionskette bestaetigt zusaetzlich: Nur ein finales
  Gruppen-ACK mit exakt vollstaendiger Personenzahl wird akzeptiert; danach
  werden Passenger-Handoff und Manifest atomar abgeschlossen und die
  bestehende Missions-UI wechselt auf „Mission startbereit“ beziehungsweise
  „Mission auswerten“. Damit bleibt die vorhandene Missionslogik unveraendert
  und der normale Missionsfortschritt wird erst nach bestaetigtem
  Animationsende freigegeben. Die Debug-Sequenzen bleiben weiterhin isoliert
  und veraendern keinen Missionsstand.

- 2026-08-17: Der zweite reale Gruppen-Deboarding-Test zeigte, dass der
  seitliche 1-m-Aufstellungsversatz einzelne Personenmodelle vom Tuerpunkt in
  den Flugzeugrumpf verschob. Der v362-Alpha-Kandidat spawnt deshalb alle
  seriell aussteigenden Gruppenmitglieder exakt am gemeinsamen definierten
  Boarding-/Tuerpunkt. Die Personen folgen weiterhin im 2000-ms-Abstand und
  ihre Laufwege faechern erst nach dem Spawn auf. Boarding-Aufstellung,
  ACK-/Manifest-Handoff, Voice-Gate und Missionsphasen bleiben unveraendert.
  Der lokale Windows-Build umfasst 48.113.280 Bytes und hat SHA-256
  `6d39d93a413ee18b0534fdd0c80f0167edf56a3cfaef7a838ee2acf9ff15c060`.
  Release `v362` ist veroeffentlicht, remote verifiziert und nur in
  `channel/alpha.json` aktiviert; Stable bleibt auf v356.

- 2026-08-17: Der reale Gruppen-Szenentest bestaetigte die isolierte
  Authority-Behandlung, zeigte aber bei 1100 ms zu eng hintereinander laufende
  Personen. Der v361-Alpha-Kandidat erhoeht den Gruppen-Stagger auf 2000 ms.
  Deboarding koppelt Spawn und Laufstart nun pro Person: Person 1 steigt aus
  und laeuft sofort, Person 2 folgt zwei Sekunden spaeter und so weiter. Die
  Tuer bleibt bis zum letzten Ausstieg offen; bestehende Stage-/Final-ACKs,
  Manifest-Handoff, Voice-Gate und Missionsphasen bleiben unveraendert. Der
  lokale Windows-Build umfasst 48.113.368 Bytes und hat SHA-256
  `43b7aaddd0809f3ad6f10b4586aa0286d4861f142778a146e2139e0b49aa29f4`.
  Release `v361` ist veroeffentlicht, remote verifiziert und nur in
  `channel/alpha.json` aktiviert; Stable bleibt auf v356.

- 2026-08-17: Tracker v360 / Host 0.6.5 korrigiert den im echten EFB noch
  verbleibenden E6B-Schliesspfad. Der frische Browserstand von v359 konnte den
  E6B bereits zweimal ueber denselben Starter umschalten; im laufenden EFB war
  das Utility-Modul jedoch ohne Revisionsparameter cachebar. Zusaetzlich lag
  das geoeffnete obere Werkzeugmenue in einem niedrigeren Stacking-Kontext als
  die E6B-Eingabeflaeche. Revision 36001 versioniert App-CSS, Map-Core,
  Utility-Modul und Host gemeinsam. Der Host enthaelt einen Rueckwaerts-Fallback
  auf `isMapUtilityToolOpen` plus `closeMapUtilityTool`, und geoeffnete
  Host-Menues werden als Body-Layer ueber dem E6B positioniert. Im lokalen
  Touch-Viewport schliessen sowohl der E6B-Eintrag im oberen Werkzeugmenue als
  auch der E6B-Button der schwebenden Werkzeugleiste nach dem zweiten Klick.
  Alle 106 Tracker-/EFB-Tests bestehen. Der Windows-Build umfasst 48.113.240
  Bytes und hat SHA-256
  `7a7c5e34034c829552e5b4973b4fcca778402fd7ad78f987b9ed9c34f681a2c6`.
  Release `v360` ist veroeffentlicht, remote verifiziert und nur in
  `channel/alpha.json` aktiviert. Stable bleibt auf v356; das
  EFB-Community-Paket bleibt auf 0.4.11.

- 2026-08-17: Web-Cache v1666 und Tracker v359 / Host 0.6.4 behandeln die
  Starter fuer Uhr/Stoppuhr, Rechner und E6B als Umschalter. Ein zweiter Klick
  auf denselben Starter schliesst das Werkzeug im Web-Kartentisch und im
  tracker-gehosteten EFB. Der native EFB-Quellstand behaelt dieselbe Semantik;
  das freigegebene Community-Paket 0.4.11 wird fuer den Host-Fix nicht neu
  gebaut. Alle 103 Tracker-/EFB-Tests bestehen. Der lokale Windows-Build
  umfasst 48.111.252 Bytes und hat SHA-256
  `04962f7ce2f943c2cd5b37b575ee2694384516d8e38060390a760854a08f5b42`.
  Release `v359` ist veroeffentlicht, remote verifiziert und nur in
  `channel/alpha.json` aktiviert; Stable bleibt auf v356.

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
  Release `v358` ist veroeffentlicht, remote verifiziert und nur in
  `channel/alpha.json` aktiviert; Stable bleibt auf v356.

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
- 2026-09-05: Der Tracker-hosted Kartentisch trennt den Missionsabruf vom
  schwereren Status-/Karten-Poll. Mission, Banner und Cargo werden im aktiven
  Fenster alle 300 bis 550 ms aktualisiert und warten nicht mehr auf Karten-
  oder Checklistenantworten. Der EFB-Verlade-Manager besitzt einen eigenen
  begrenzten Scrollbereich mit dauerhaft erreichbarem Kopf; das bestehende
  Menue `Audio auf diesem Geraet abspielen` ist im EFB wieder sichtbar und kann
  den erforderlichen Wiedergabe-/Audio-Unlock per Benutzeraktion setzen.
- 2026-09-06: Der EFB-Verlade-Manager bildet Kopf und Inhalt als echte
  begrenzte Flex-Spalte ab; Touch-Scroll und untere Signatur-/Abschlussbuttons
  bleiben erreichbar. Der gemeinsame APT-UI-Kern unterdrueckt im Reiseflug
  Banner explizit, zeigt `Deboarding laeuft` bereits waehrend der physischen
  PAX-Sequenz und bleibt bei Signatur-/Cargo-Aktionen revisionsgebunden. Voice
  wird bei einer Benutzeraktion fuer Coherent entsperrt. Pinnwand-Restore und
  bestaetigter Mission Reset publizieren unmittelbar einen neuen geplanten
  Trackerstand, damit App und EFB denselben Neustart anbieten.
- 2026-09-07: App und EFB wiederholen einen seiteneffektfreien Run-Konflikt
  desselben Missionsstarts genau einmal mit der vom Tracker bestaetigten
  aktuellen Run-ID. Ein frisch geladener Cloud-Auftrag erscheint im leeren
  Tracker-Zustand nach hoechstens rund 2,5 Sekunden. Zentrale Voice-Gates
  unterscheiden jetzt eine lediglich audiofaehige Sitzung von einer wirklich
  beanspruchten Playback-Lease; ohne Claim bleiben Boarding, Signatur und
  Abschluss nicht mehr bis zum langen Audio-Timeout blockiert.
- 2026-09-07: Jeder autoritative Execution-Checkpoint wird unmittelbar an alle
  Relay-Clients verteilt; der schnellere EFB-Poll ist damit nicht mehr noetig,
  um Signatur-, Payload- oder Deboarding-Fortschritt zuerst zu sehen. Nach der
  Entladebestaetigung wartet allein der Tracker auf Farewell-, Payload- und
  Szenen-ACKs und schliesst den Run anschliessend, statt dass ein Client zu
  frueh `request_close` sendet. Ein geschlossener Run derselben Mission darf
  durch Capability-Late-Bind nicht erneut auferstehen. Verladeaktionen bleiben
  in beiden Oberflaechen auf die passenden Bodenphasen begrenzt.
- 2026-09-07: Tracker v386 serialisiert sichtbare Cargo-/Signaturaktionen auch
  in der Origin-App: Waehrend ein Intent laeuft, sind alle weiteren Aktionen
  mit einem gemeinsamen `Tracker verarbeitet ...`-Stand gesperrt und koennen
  nicht mehr versehentlich mit dem Promise einer anderen Aktion quittiert
  werden. Ankunftssignatur und Bestaetigung werden erst nach abgeschlossenen
  Deboarding- und Payload-Effekten freigegeben. Ein terminal geschlossener Run
  wird bei einem Relay-Reconnect nicht erneut akquiriert. App- und EFB-Assets
  tragen getrennte Cache-Revisionsmarker; Stable und der Alpha-Legacy-Pfad
  bleiben unveraendert.
- 2026-09-08: Lokale Korrekturen nach dem v386-APT-Test (noch kein Release):
  - Tracker-Apps sind Beobachter desselben Runs. Browser-Owner und abweichende
    lokale/Cloud-Missionskopien erzwingen im Tracker-Modus keine Uebernahme;
    ein weiteres Geraet restauriert den Trackerstand automatisch. Die bisherigen
    Konflikt- und Owner-Regeln bei Web-Authority bleiben erhalten.
  - App und EFB reihen verschiedene Manifest-Intents mit der jeweils aktuellen
    Revision ein; doppelte Klicks auf dieselbe ausstehende Aktion werden vereint.
    Payload-Pruefung und Sim-ACK bleiben zentral. HTTP-Intent-ACKs warten wie
    Relay-ACKs nur auf den Commit; Voice blockiert den Effect-Runner nicht mehr.
  - Eintritt in Boarding oeffnet den Verlade-Manager auf beiden Interfaces.
    Signaturanimationen repainten nach ihrem Timer auch ohne neuen Snapshot.
    Ein explizit leeres Banner des APT-UI-Kerns bleibt im Flug leer.
  - Auf ausdruecklichen Wunsch bleibt das Verladefenster optisch und in der
    Bedienung am Standalone-Vorbild. Der EFB rendert dieselbe Panelhierarchie
    und nutzt deren unveraenderte styles.css-Regeln fuer Groesse, Abstaende
    und Scrollen. Der zuvor zusaetzliche Flex-/Scroll-Body entfaellt. Normale
    Hinweise erscheinen ohne Tracker-Warnstil, Bestaetigungen ohne zusaetzliche
    Erfolgszeile. Vergleich von Standalone-Renderer und EFB mit identischen
    Daten: Texte und Elementgeometrie gleich; Abschlussbuttons auch bei
    24 Positionen per Scrollen erreichbar (1024x768, 800x480 und 390x660).
  - Zentral erzeugtes Audio spielt ueber WebAudio (HTMLAudio als Fallback).
    Fehlende gespeicherte Lautstaerke bedeutet 100 Prozent, nicht stumm.
    Fehlgeschlagene Playback-Leases werden nicht endlos erneut beansprucht;
    ein haengender Decoder gibt nach 8 Sekunden frei. Laufende Clips verwenden
    ihre echte Dauer. Der beim Touchdown vorbereitete Farewell-Job wird wiederverwendet.
  - Die PAX-Zeile am Ziel wartet wie in Standalone auf Pflichtfracht und
    Unterschrift und startet danach denselben confirm_unload-Ablauf mit
    Farewell und Deboarding wie der Hauptbutton. Ein verfruehtes separates
    Deboarding ueber diese Zeile entfaellt. Bereits bestaetigte manuelle
    Sequenzen bleiben beim Abschluss als abgeschlossen markiert. Die
    Standalone-Funktionen und Manifest-Erfolgskriterien bleiben unveraendert.
  - Standard-APT mit Passagier: zentraler 4-NM-Anflugtrigger, einmal pro Run,
    mit 2 Sekunden Vorlauf, privatem App-Kontext und Live-Telemetrie. Der
    Prompt ist gegen die unveraenderte `_atTargetPrompt`-Funktion verglichen.
    `voice.approach` ist ein additiver, persistierter Effekt ohne Missionsgate;
    App/EFB zeigen die neueste Ansage. Die alte Standalone-Triggerkette bleibt.
  - Pruefung: Tracker-/Core-Suite, zehn App-/Differential-Selftests und lokaler
    Windows-pkg-Build. Ein aelterer Cargo-UI-Test erwartete faelschlich noch
    `request_close` als Client-Folgebefehl; das ist seit v386 Tracker-Aufgabe.
    MSFS-Coherent, tatsaechlicher Audioausgang und paralleles Smartphone muessen
    mit einem neuen APT-Testlauf auf dem naechsten Alpha-Build bestaetigt werden.

### 08.09.2026 — weitere Standard-A–B-Paritaet

Anflug-Guards an den unveraenderten Standard-APT-Trigger angeglichen
(keine extra Enroute-/Airborne-/Manifest-Loaded-Bedingung, weiterhin
Missionsende- und Duplikatschutz). Cargo-Equipment nutzt den originalen
normalisierten Flugzeugslot im Objektschluessel. EFB-Signaturanimation und
Freigabe verwenden die zentrale Signaturzeit auch bei Remote-Aktionen;
der zentrale UI-Core liefert beide Timerzustaende nach denselben Regeln.
Neue Differentialnachweise und verbleibende Luecken stehen in
`Tracker Standalone Parity Audit 2026-09-08.md`. Kein Standalone-Missionspfad
geaendert; volle A–B-Ablaufparitaet bleibt noch offen.

### 08.09.2026 — manuelle PAX und weitere Standard-A–B-Effekte

Tracker fuehrt jetzt manuelles Ein-/Aussteigen mit originalen Sim-Rezepten,
Tuertimern und 70-s-Rollback aus. App/EFB projizieren denselben laufenden
Vorgang. Cargo-Objekte nutzen pro Objekt eine 180-ms-Sollzustandsqueue und
persistierte Revisionen; originale Cargo-/PAX-Sounds laufen als Cue-only Jobs
ueber die zentrale Audiovergabe. Komfort-, Wrong-Start-, Off-Destination-,
Landing-Roll- und Pflichtfracht-Ansagen verwenden generierte Kopien der
unveraenderten Standalone-Funktionen samt originalen Timern und Guards.
Der Eventadapter behaelt die Anflug-/Flugansage-Payloads jetzt vollstaendig.
336 Tracker-/Core-Tests und 18 Fenstervergleiche sind gruen; weitere
Differentialtests pruefen die echten Standalone-Funktionen. Restgrenzen und
der noch abzugleichende 4,5-NM-Low-Speed-Anflugfallback stehen im Paritaetsaudit.
Reale MSFS-Animationen und Audioausgabe sind weiterhin im Sim zu bestaetigen.

### 08.09.2026 — Low-Speed-Anflugfallback

Der zentrale Standard-A–B-Lauf uebernimmt auch den Standalone-Fallback bis
4,5 NM beim ersten langsamen Landekandidaten nach einer Flugphase. Unter
18 kt und unter 140 ft AGL, aktiver Recorder, gemeinsamer Anflugeffekt mit
Ende-/Duplikat-Guards und bestehender 2-s-Verzoegerung. Pausen/Menu verbrauchen
den Kandidaten nicht. 12 Ereignisspuren gegen den echten Standalone-Zweig
decken Grenzwerte, erneute Kandidaten und einmalige Ansage ab. Standalone
bleibt unveraendert; keine zusaetzliche Client-Triggerlogik.


### 08.09.2026 — weitere Ablaufkorrekturen und Karten-UI-Paritaet

Audiovergabe auch zwischen verschiedenen Jobs geraeteuebergreifend exklusiv;
Anflug-/Landing-Roll-Jobs werden bei Missionsende waehrend Generierung oder
vor Playback abgebrochen. Komfort sperrt schon beim Anfordern des Anflugs.
Boarding bekommt Live-Position direkt aus dem Simulator; Off-Destination
prueft Boden-Ticks und den Original-Recorder-Lebenszyklus samt Cooldown.
Keine Veraenderung der Standalone-Ausfuehrungsfunktionen.

EFB-Banner verwendet originale Breite und Texte. Die drei Telemetriefenster
verwenden originale Abstaende/Hintergruende, Schriftstandard 100 Prozent und
Ausblenden ueber das Anzeigemenue. Steigrate, GS-Nachkommastelle, MSL-Farben,
AKTUELL-Ortsreferenz und NEXT-LEG-Frequenz/Gradzeichen angeglichen. Bestehende
explizite Schriftgroessen bleiben erhalten; Standard stellt CSS-Regeln wieder
her. 378 Node-Tests und 15 Browservergleiche dieser Kartenkomponenten gruen.
Vollstaendige MSFS-/Coherent-/Mehrgeraete-Pruefung weiterhin im Simulator.


### 08.09.2026 — Alpha-Rollout v387

Release v387 veroeffentlicht (Commit 9d7726a5a), EFB-Assetrevision 38701.
Alpha-Kanal auf die verifizierte EXE mit 50.479.960 Bytes und SHA-256
`f30b589087b0cc006b3405fd707741d1e1002e82398ba7b3027f4a45687926d2`
umgestellt. Origin-App-Cache v1712. Stable-Runtime v356 und EFB-Community-
Package bleiben unveraendert; EFB-Host-UI kommt aus dem neuen Tracker.
378 Tests einschliesslich aktualisierter Versionspruefungen sowie die zuvor
bestandenen UI-/App-Differentialvergleiche bilden den Release-Nachweis.

### Lokale Folgekorrekturen nach dem v387-Feldtest (08.09.2026)

Noch nicht veroeffentlicht. Die drei Feldlogs zeigen erfolgreiche Manifest-
Intents und Payload-Syncs, aber weiterhin `boarding`, keinen `start_mission`-
Intent und fehlgeschlagene EFB-Playback-Leases nach jeweils etwa 75 Sekunden.
Ankunftsszene und Flugfortschritt sind damit in diesem Lauf nicht unabhaengig
von der Startblockade bewertbar.

- `close_cargo_window` verteilt eine revisionsgebundene, rein praesentative
  Schliessaktion. Alle Beobachter schliessen erst nach dem Tracker-Snapshot;
  spaeter beitretende Geraete oeffnen ein bereits geschlossenes Boardingfenster
  nicht erneut. Standalone schliesst weiterhin lokal.
- Der EFB setzt Schriftgroessen vor einer Neuberechnung auf die originalen
  CSS-Werte zurueck und skaliert neuen Cargo-Inhalt synchron vor dem Zeichnen.
  Der Schriftgroessenhinweis verursacht keine dauernde MutationObserver-Schleife.
- Tracker-Beobachter nehmen nicht am Legacy-Authority-Late-Bind teil.
- Das Tracker-Ereignisjournal bildet bei seinem Groessen-/Ereignislimit einen
  vollstaendigen Zustandscheckpoint. Der Feld-Belastungstest scheitert mit dem
  bisherigen Manager nach 37 Ereignissen an `resume_bundle_too_large`; mit der
  Korrektur laufen 190 Ereignisse, Payload-Bestaetigung und Replay durch.
  Ausstehende Effekte werden nicht mehr durch die 48-Effekte-Historie verdraengt.
- `voice.relay.v1` bietet entfernten Tracker-Interfaces Next/Claim/Release und
  begrenzte Audio-/Cue-Chunks ueber die bestehende PIN-gepruefte Relay-Verbindung.
  Es ist kein HTTP-Proxy und erzeugt keine neuen Voice-Jobs. Der Web-Client
  dekodiert dieselben zentral erzeugten Bytes mit Web Audio. Ein stockender
  HTMLAudio-Player gibt seine Lease retrybar frei; derselbe fehlgeschlagene
  Client bekommt den Job nicht erneut, ein anderes Geraet kann uebernehmen.
  Legacy-Voice-Erzeugung und Standalone-Missionsregeln bleiben unveraendert.

Validierung: 385 Node-Tests, Interface-/Handoff-/Update-Sync-/Flight-Recorder-
Differentialpruefungen, 18 Cargo- und 15 Karten-UI-Vergleiche bestanden.
Cargo-Vergleiche umfassen wiederholte Repaints bei 110 % Schriftgroesse und
Scroll-Erreichbarkeit. Windows-Test-EXE erfolgreich gebaut; ein erneuter
MSFS-Test mit hoerbarer Voice, Missionsstart, Flugfortschritt und Ankunftsszene
bleibt fuer die tatsaechliche End-to-End-Bestaetigung erforderlich.

### 08.09.2026 — Zentrale Audioausgabe: Entscheidung und erster Implementierungsblock

Freigegebenes Ziel: PC/Tracker ist Standardausgabe; alternativ wird genau eine
persistente App-Geraete-ID gewaehlt. App und EFB bedienen die gemeinsamen
Stimmen-, Lautstaerke- und Kategorieeinstellungen. Die Geraetewahl liegt in
einem eigenen authentifizierten Cloud-Datensatz und ist kein Missionsimport.
Lokales TTS wird vorerst nicht umgesetzt; spaeterer Provider-Anschluss bleibt
ein eigener Ausbaupunkt.

Kein separat zu installierendes Soundpaket: GitHub bleibt Quelle der statischen
Clips. Fuer den PC gibt es einen versionsbezogenen, atomaren Dateicache mit
Download-Deduplizierung, Timeout, Typ-/Groessen- und Pfadpruefung. Bereits
vorhandene gebuendelte Mission-Cues bleiben fuer die bisherige Wiedergabe nutzbar.
Entfernte Apps beziehen bekannte statische Mission-Cues jetzt direkt von GitHub
mit Browser-Cache; nur generiertes Audio muss durch den Tracker-Relay.

Implementiert und lokal integriert: Audio-Konfigurationskern mit PC-Default,
revisionsgebundenen Updates und lokaler Persistenz pro Pilot; eigener
PIN-geschuetzter Worker-Endpunkt `/api/audio-settings/<pilot>`; lokale
`/api/v1/audio/settings`- und `/api/v1/audio/assets/...`-Schnittstellen sowie
Settings-Aktionen im bestehenden PIN-geprueften Voice-Relay. Tracker-Status
enthaelt die Audio-Konfiguration. Cloud-Ausfaelle werden mit Backoff erneut
versucht. Stable/Standalone initialisieren den neuen Audio-Kern nicht.

Noch NICHT fertig oder als Gesamtfunktion aktiviert: Menueanschluss App/EFB
und Desktop, persistente Browser-Geraete-ID, exklusive Durchsetzung der neuen
Auswahl im Player, PC-Wiedergabe inklusive Hardware-Ausgangswahl, Uebernahme
aller Warn-/Ansage-Trigger und ereignisgesteuerte/gezielt adressierte Relay-
Benachrichtigung. Der Konfigurationskern allein veraendert die bisherigen
Playback-Leases nicht. Deshalb darf dieser Zwischenstand nicht als fertige
PC-Audioumstellung veroeffentlicht werden. Kein neuer Rollout erfolgt.

Validierung dieses Zwischenstands: 392 Missions-/Tracker-/EFB-/Worker-Tests
bestanden, anschliessend zusaetzlicher Test fuer zusammengefasste Cloud-Updates
bestanden. Der Remote-Playback-Test prueft, dass statische Cues GitHub nutzen
und keine Cue-Chunks durch den Relay schicken. Windows-Paketierung als reine
Test-EXE geprueft; keine Aenderung an Release-/Cache-Versionsnummern.

### 08.09.2026 — PC-Player und Geraeteumschaltung fuer Missionsaudio

Der folgende Block schliesst PC-Player, Ausgabe-Menues und exklusive
Geraeteumschaltung fuer die bereits zentralisierten Missionsansagen und
Pax-/Cargo-Cues an. Er ist lokal implementiert, noch nicht ausgerollt.

- Die neue Tracker-Desktop-App meldet ihren Player ueber
  `VFR_MULTITOOL_DESKTOP_AUDIO_PLAYER=1`. Nur Alpha plus APT-Opt-in plus neuer
  Desktop-Player aktivieren `audio.output.v1`. Aeltere Desktop-Versionen und
  die direkt gestartete Konsolen-Runtime behalten den bisherigen Playback-
  Pfad. Ein Runtime-Update allein schaltet deshalb keine stumme PC-Ausgabe ein.
- Ein gemeinsamer Web-Audio-Player laeuft im Desktop sowie in App/EFB.
  Er nutzt die vorhandenen zentralen Jobs und erzeugt beim Geraetewechsel
  keine neue Synthese. PC-Playback ist an das private Desktop-Token gebunden.
- Fuenf Sekunden lange Playback-Leases werden waehrend der Wiedergabe
  erneuert. Der Player stoppt lokal vor dem Lease-Ablauf; zusaetzlich wird
  der Web-Audio-Source-Stop vorausgeplant, damit ein gedrosselter Browser-
  Timer keine gleichzeitige Wiedergabe auf zwei Geraeten erlaubt.
  Beim Wechsel meldet das alte Geraet Cue/Voice-Stufe und Sekundenposition
  zurueck. Erst danach oder nach Lease-Ablauf darf das neue Geraet fortsetzen.
- App/EFB besitzen eine persistente Geraete-ID; einzelne Tabs behalten
  getrennte Session-/Lease-IDs. Die Relay-Join-ID wird bereits vor dem
  Laden des Cockpit-Clients festgelegt. Audio-ACKs und generierte Bytes
  gehen im Cloudflare-Relay nur an den anfragenden Client.
- Tracker-Statusnachrichten informieren ueber neue Jobs und Einstellungen.
  Entfernte Interfaces fragen im Leerlauf nicht fortlaufend nach Audio.
  Kurze Renew-Nachrichten entstehen nur waehrend einer Wiedergabe.
  Der Text einer auf dem PC laufenden Ansage bleibt auch in den Interfaces
  sichtbar. Statische Remote-Cues verwenden weiterhin GitHub/Browser-Cache;
  der PC nutzt fuer vorhandene Mission-Cues die bereits gebuendelten Dateien.
- Menues bieten PC/Diese App und zeigen ein anderes gewaehltes Geraet an.
  Master, Lautstaerke, Pax-Stimme und Effekte verwenden im Tracker-Lauf den
  gemeinsamen Zustand. Ein im alten App-Rezept gespeichertes Audio-aus darf
  die neue PC-Ausgabe nicht mehr unterdruecken. Die Original-Rezepte und der
  Standalone-Ausfuehrungspfad werden dabei nicht veraendert.
- Der Desktop speichert den physischen Audioausgang lokal, getrennt von
  Pilot/PIN und Cloud-Ausgabewahl. Das Fenster spielt auch minimiert weiter.
  Ausgangswahl verwendet `AudioContext.setSinkId()` fuer verfuegbare und
  erlaubte Ausgaenge; fehlt ein gespeichertes Geraet, gilt Windows-Standard.
  Es wird kein Mikrofonstream angefordert. Verfuegbarkeit und vollstaendige
  Geraeteliste muessen zusaetzlich auf dem Ziel-Windows-System geprueft werden.

Abgrenzung: Allgemeine AWM-/TAWS-, Luftraum- und Wegpunkt-Warnungen inklusive
Warnstimmenwahl sind mit diesem Block noch nicht in den Tracker migriert.
Ihre bisherigen App-Trigger und die zugehoerigen Einstellungen bleiben
bestehen. Dieser Stand ist deshalb keine abgeschlossene Migration ALLER
Audioquellen. Lokales TTS bleibt weiterhin nur als spaeterer Ausbau vorgemerkt.

Validierung: automatisierte PC/App-Wechsel- und Verbindungsabbruchtests,
Mehrgeraete-Menuevergleich mit Original-App-Markup, Persistenz nach Reload,
Lautstaerke-/Pax-Synchronisation und gezielte Relay-Zustellung. Screenshot-
Testserver liefert HTML ausdruecklich als UTF-8; Tests pruefen CharacterSet
und die urspruenglichen Terrain-/Pilot-Symbole. Windows-Runtime-Testbuild und
Desktop-Windows-Verzeichnisbuild sowie Inhalt des ASAR-Pakets geprueft.
Hoerbare Wiedergabe und Ausgangswahl unter realem Windows/MSFS bleiben der
anschliessende Feldtest; keine Release-/Kanaldatei wurde umgestellt.

### 08.09.2026 — Simulator-Teststand ohne MSFS

`ga-tracker-client/teststand/start.js` ist ein separater Entwicklungsstart:
Er startet den aktuellen Tracker mit einem Ersatz fuer `node-simconnect.open()`.
Die normale EXE und Standalone werden dadurch nicht veraendert. Der Adapter
liefert binaere SimConnect-Daten fuer Flug und Standard-Payloadstationen,
uebernimmt Payload-Schreibbefehle und bildet Objekt-IDs, Spawn/Remove-Events,
Initialpositionen sowie bewegte Waypoint-Listen ab. Die Missions-ACKs kommen
weiterhin aus den echten Tracker-Handlern, nicht aus einer zweiten Mission-
State-Machine im Teststand.

Die lokale Bedienseite bietet A/B-Koordinaten, Platzhoehen, Flugabschnitte,
Pause und gezielt ausbleibende Simulatorantworten. App/EFB bleiben die
Interfaces fuer Boarding, Manifest, Signaturen und Abschluss. Testdaten werden
isoliert gespeichert; bestehende Konfigurationen werden nicht migriert.
Der manuelle Start verwendet normale Cloud-Anmeldung mit separater Test-ID.
`--demo` zeigt nur den Simulator, ohne Tracker-Missionslauf oder Cloud.

Validiert: fuenf Simulator-/HTTP-Tests, echte Tracker-Telemetrie und Payload-
Dekodierung, Spawn-/Clear-ACKs aus den realen Szenenhandlern sowie ein Offline-
A–B-Cargolauf bis `lastExecution.phase=closed`, `payload.status=ok` und
freigegebener Authority. Dabei wurden Laden, Departure-Signatur, Load-Confirm,
Missionsstart, Airborne, Touchdown, Stillstand, Entladen, Arrival-Signatur und
Unload-Confirm geprueft. Das synthetische Fixture enthaelt ein Boarding-Objekt,
aber keinen vollstaendigen Pax-/Deboarding-/Voice-Feldauftrag. Es belegt keinen
hoerbaren Audiolauf. Desktop-/Mobil-Browsertest inklusive UTF-8 bestanden.

Bedienung, Grenzen und Befehle: `ga-tracker-client/teststand/README.md`.
Keine Veroeffentlichung oder Versionsaenderung mit diesem Testwerkzeug.

### 08.09.2026 — Rollout v388 und Windows-Teststand

Origin-Release-Commit `1275d73d3`, Runtime-Release `v388`, EFB-Assetrevision
38801. Alpha verwendet die heruntergeladene und gegen den Build verifizierte
Runtime mit 50.549.794 Bytes und SHA-256
`47c695e64588d261190ac0333eeb04b19207870e520bfaf4d286dd2551a2c875`.
454 Regressionstests, Audio-Menue-/Geraetewechseltest und acht isolierte
Worker-Tests bestanden. Der App-Cache wird mit dem Kanal-Push v1714.

Desktop `tracker-desktop-v1.6.6` mit Installer, Blockmap und latest.yml
veroeffentlicht. Installer-Download und ASAR-Inhalt verifiziert. Der Origin-
Downloadlink zeigt auf diesen Installer. Der globale Desktop-Autoupdatezeiger
bleibt bis zum Windows-Installations-/Start-/Update-Nachweis unveraendert;
Alpha-Tester installieren 1.6.6 manuell fuer die neue PC-Audioausgabe.
Stable-Runtime und EFB-Community-Paket bleiben unveraendert.

Cloudflare `ga-proxy` Version `025e87db-eebd-47ec-9f0a-82653392036a` und
`ga-relay` Version `dcd1e6e5-7be4-48f3-8b30-7593801516b7` sind ausgerollt.
Der neue Settings-Endpunkt fordert Pilot/PIN; der Relay meldet ready.
Nicht zugehoerige lokale Admin-Aenderungen wurden nicht mit ausgerollt.

`GA-Mission-Teststand-v388.exe` und Desktop-Installer liegen mit Startanleitung
und Hashliste in OneDrive/GA Dispatcher Test Tools/Mission-Teststand-v388.
Die portable Teststand-EXE enthaelt Node und oeffnet per Windows-Doppelklick
die Bedienseite. Ihre Ablage ist separat unter LocalAppData/Teststand-v388.
Binaerformat und Kopierhash sind geprueft; der tatsaechliche Windows-Start und
hoerbare PC-Ausgabe bleiben der anschliessende Feldtest.

### 08.09.2026 — App-Verladefenster bleibt nach Schliessen zu

App-Hotfix nach v388: Das X blendet das Verladefenster sofort lokal aus,
auch ohne Tracker. Der bestehende `close_cargo_window`-Intent synchronisiert
nur noch best effort die Darstellung; er ist keine Voraussetzung fuer das
Verlassen des Dialogs. Fachliche Missionsaktionen bleiben ACK-gebunden.
Nachlaufende Renderer duerfen ein geschlossenes Tracker-Fenster nicht erneut
einblenden. Das automatische Boarding-Oeffnen wird pro Run in der lokalen
UI-Sitzung gemerkt, unabhaengig von leeren/wechselnden Tracker-Snapshots.
Bewusstes Oeffnen bleibt moeglich. Standalone-Rendering bleibt unveraendert.

Regressionen fuer Offline-Schliessen, leere/wechselnde Runs, spaete Repaints,
explizites Oeffnen und unveraenderten Standalone-Pfad bestanden. Dies ist ein
Web-App-Hotfix (Cache v1715); Runtime v388 und Teststand-EXE bleiben gleich.


### Smartphone-Feldtest 08.09.2026: Signatur, Audio und Reconnect (lokaler Fix)

Analyse des Laufs `run-mtssou0v-62fff730de2596`: Boarding/Tuer um 16:59:41
abgeschlossen, 187 lbs um 16:59:45 bestaetigt, Signatur um 17:00:17 und
finaler Payload-Abgleich um 17:00:25 erfolgreich. Boarding-Voice war seit
17:00:00 generiert, aber erst ihr Playback-Timeout um 17:02:56 gab den
Uebergang nach `boarded` frei. Der Log beweist den Playback-Stillstand, nicht
welcher iOS-Schritt (Download/Decode/AudioContext) hing.

Gezielte Korrekturen, ohne neue Missions-State-Machine oder geaenderte Gates:
- Eine explizit beendete lokale Signaturanimation hat Vorrang vor der
  Tracker-Uhr. Spaete Intent-ACKs starten dieselbe Animation nicht erneut.
- Tracker-Verladefenster lesen die zentrale Payload-Projektion; blosses
  Zeichnen startet keine weiteren Legacy-Sim-Abfragen pro Endgeraet.
- Reconnect-Cleanup wartet auf den Authority-Handshake; abgewiesene
  Legacy-Clear-ACKs setzen keine projizierten Boarding-Flags zurueck.
- Audio-Vorbereitung (Laden, Decode, Context-Resume) hat begrenzte Wartezeit.
  Laufende AudioContexts werden nicht erneut resumed. Ausbleibendes onended
  ist ebenfalls begrenzt. Ein fehlerhafter Cue unterdrueckt keine nachfolgende
  Sprache; terminale Player-Fehler geben die Reservierung frei und werden
  als VOICE_PLAYBACK_FAILED mit Grund protokolliert.
- Remote-Audiodaten werden mit maximal vier parallelen 24-KiB-Anfragen
  geladen, weiterhin mit Groessen-/Offsetpruefung und Abbruch bei Timeout.
  Die uebertragene Nutzdatenmenge bleibt gleich.
- Audio-Select und Status passen in den mobilen Frame (box-sizing,
  min-width und Textumbruch).

Validierung: deterministische Queue-/Audio-Fehler- und Uhrversatztests,
702764-Byte-Remote-Download mit exaktem Bytevergleich, echte Web-Audio-Cue-
und Voice-Wiedergabe im lokalen Chromium, mobile Menubreite und bestehende
Standalone-/EFB-Characterization. Reales iPhone/Safari und MSFS sind hier
nicht als bestanden behauptet. Dieser Eintrag ist kein Release-Nachweis.


### Rollout 08.09.2026: Tracker v389 / Desktop 1.6.7

Der Smartphone-Fix ist unter Commit `da9f205d6` versioniert, Runtime-Tag
`v389`, EFB-Assetrevision `38901`. Alpha-Runtime: 50552372 Bytes,
SHA-256 `53846b9f21b5eee6604bdff4a565594f0acbb1a892794a11a7867b6320b80fe2`.
Desktop-Tag `tracker-desktop-v1.6.7`: Installer 100270046 Bytes,
SHA-256 `f81795169f81052a5b7c7f044f2aa5e6dbd6342f4e956f15250f4c6f012b293c`.
Installer, Blockmap und latest.yml bilden ein gemeinsames Release.

163 Release-Tests bestanden. Desktop-Build verwendet `signExecutable=false`
statt `signAndEditExecutable=false`: Icon und Version werden eingebettet;
PE-Ressourcen fuer 1.6.7 und sieben Icons wurden nach dem Build gelesen.
Der Offline-Audiotest simuliert jetzt eine vollstaendig unterbrochene
Verbindung (auch next/claim/release), statt nur renew zu unterbrechen.

Origin-Downloadbutton zeigt auf den manuellen Alpha-Installer 1.6.7;
App-Cache v1717. Runtime-Stable und globaler Desktop-Autoupdate-Zeiger bleiben
unveraendert. Ein echter Windows-Installations-/Start-/Update-Test sowie der
iPhone-/MSFS-Feldtest stehen weiterhin aus. Kein Cloudflare-Deployment noetig.

### Lokaler Fix 08.09.2026: Preflight-Handoff und Smartphone-Audio-Lebenszyklus

Der Feldtest 17:54–17:59 lief nach gescheiterter Uebergabe mit Web-Authority:
Ein ereignisloses Planned-Journal hielt einen alten Payload-Outcome fest und
scheiterte an `legacy:payload`. Vor dem ersten Runtime-Event wird dieser Seed
bei geaendertem Payload aus dem aktuellen Preflight-Snapshot neu aufgebaut.
Journale mit Runtime-Ereignissen behalten ihre Driftpruefung. Der Start merkt
sich die angeforderte Tracker-Ausfuehrung pro Mission ueber eine temporaere
Capability-Luecke; ein expliziter neuer Handshake ohne Opt-in hebt dies auf.

Der App-Audioclient entsperrt den ausgewaehlten Ausgabeplayer synchron im
Touch-/Click-Handler auch vor der Authority-Uebergabe. Nach pagehide/pageshow
wird der beendete Player neu erstellt, mit genau einem Polling-Zyklus.
Verspaetete HTTP-Antworten aus dem vorherigen Lebenszyklus werden verworfen.
Standalone-Missionsregeln und der alte Passenger-Voice-Player bleiben unveraendert.

Nachweise: 8 Journal-, 11 Authority-Handoff- und 2 Audio-Client-Tests bestanden;
Interface-Regressionssuite und Chromium-Audio-UI-Selbsttest bestanden.
Der neue Handoff-Test geht vom geaenderten Payload bis zum akzeptierten
Tracker-Prepare. Ein realer Safari-/PWA-Hoertest steht aus; das beobachtete
fehlende onended im alten App-Player ist dadurch nicht als reproduziert oder
abschliessend behoben nachgewiesen. Diese Aenderungen sind noch kein Rollout.

### Release-Kandidat 08.09.2026: v390 / Smartphone-Audio-Menue

Runtime v390, EFB-Webassetrevision 39001, App-Cache v1719 enthalten den
Preflight-Handoff-Fix und die Smartphone-Audio-Lebenszykluskorrektur.
Der Audio-Menue-Test verwendet jetzt die echten App-Styles und prueft den
gesamten Rahmen: der Test reproduzierte Overflow durch 100%-Labels mit
Padding, intrinsisch breite Selects sowie eine 100%-Master-Checkbox.
Gezielte Menu-CSS korrigiert Box-Sizing, Select-Minimalbreite, Textumbruch
und Checkbox-Groessen, ohne horizontales Abschneiden von Inhalten.
38 Core-/Authority-/Audio-/EFB-Tests, die Interface-Regressionssuite sowie
der Chromium-Audio-UI-Test bestanden. Safari-Hoertest bleibt Feldtest.
Desktop 1.6.7 und Stable bleiben unveraendert; kein Worker-Deployment.

Rollout: Code-Commit `7262735f4`, Tag `v390`; EXE-Upload auf GitHub
verifiziert, 50553671 Bytes, SHA-256
`ba7bc55aed739941ba21db5e440ff6c42b091efa54664b81f02bd3680d5903aa`.
Alpha-Zeiger folgt diesem Asset; finaler App-Cache v1720.

### Feldtest v390 / lokale Nacharbeit: unmittelbare Cargo-Rueckmeldung

Feldtest 18:46–18:52 bestaetigt Tracker-Ausfuehrung und hoerbare Voice am
Smartphone. Altlauf benoetigte Clear, neue Mission startete. Die Signatur
wurde erst nach dem Boarding-ACK angeboten. Der aktuelle echte Standalone-
Sim-Pfad wartet ebenfalls auf den geladenen PAX; die gewuenschte fruehere
Signatur ist deshalb als explizite Entkopplung zu behandeln, nicht als bereits
nachgewiesene Paritaet. Start-Gates duerfen dabei nicht vorzeitig oeffnen.

Lokaler UI-Fix: ausstehende Item-Intents zeigen unmittelbar Laden/Entladen
vorgemerkt, sperren nur die betroffenen Items und behalten den bestaetigten
Manifeststatus. 14 APT-UI-Tests bestanden. Noch nicht ausgerollt. Die physische
Bearbeitungsdauer und Altlauf-Blockade benoetigen die Tracker-Logs des neuen
Testfensters; der App-Auszug enthaelt keine vollstaendige Item-ACK-Zeitlinie.

Nachtrag: User bestaetigt, dass die bisherige Signaturwahrnehmung taeuschte;
Unterschrift und Boarding-Gates bleiben ausdruecklich unveraendert.
Tracker-Logs zeigen beim Altlauf bereits MISSION_STARTED im Replay und
spaeter mission_execution_handoff_phase_not_safe. Kein automatisches Reset
oder erzwungener Mid-Run-Handoff. Beim neuen Lauf scheiterte der erste Prepare
18:46:49 an einer konkurrierenden Snapshot-Revision; der zweite gelang.
_queueMissionAuthoritySnapshot unterdrueckt nun neue sowie bereits geplante
Hintergrund-Sends waehrend des Handoff-Promises. Der explizite Handoff-Seed
bleibt erhalten. Ausfuehrbarer Regressionstest bestaetigt beide Sperren und
normale Snapshot-Funktion ausserhalb der Uebergabe. Lokal, noch kein Rollout.

### Release-Kandidat 08.09.2026: Tracker v391

v391 / EFB-Assetrevision 39101 enthaelt die unmittelbare Item-Queue-Anzeige
und den Schutz der Authority-Uebergabe vor Hintergrund-Snapshots. Signatur,
Boarding-Gates und physische Sim-Wartezeiten bleiben unveraendert.
42 Core-/Authority-/EFB-Tests sowie die Interface-Regressionssuite bestanden.
Desktop bleibt 1.6.7; kein Worker- oder Community-Package-Update erforderlich.

Rollout v391: Code-Commit `011df5f7c`, EXE-Upload verifiziert, 50553927 Bytes,
SHA-256 `34092deed8d4f2a3a19be70046bdd93d4bcb38bbe85d79c43e941fc10ac15aca`.
Alpha-Zeiger folgt diesem Asset; finaler App-Cache v1722. Stable unveraendert.

### Lokale Optimierung: Boarding-/Begruessungs-Voice vorladen

Nach akzeptiertem prepare_mission startet der Tracker nun best-effort die
Text-/TTS-Erzeugung fuer den kombinierten Boarding-/Begruessungsblock.
Die bestehende Voice-Service-Warteschlange verwendet dafuer einen pro Run
stabilen boarding-preload-Auftrag mit deferPlayback. Der Intent-ACK wartet
nicht auf Textgen, TTS oder Wiedergabe. Am bisherigen voice.boarding-Effekt
wird ein passender pending/ready-Auftrag wiederverwendet und aktiviert.
Der vorhandene Request-Fingerprint verhindert Wiederverwendung bei geaenderten
Stimmen, Audio-Einstellungen oder Startkontext; dann wird der normale aktuelle
Effekt erzeugt. Ohne Preload bleibt der bisherige Pfad erhalten.
Standalone-Ablauf, Unterschrift, Boarding- und Start-Gates bleiben unveraendert.
38 Boarding-Voice-/Runtime-Tests bestanden, darunter Vorbereitung ohne Warten,
Reuse einer laufenden Generierung und Verwerfen eines unpassenden Preloads.
Rollout vorbereitet als Tracker Alpha v392; App-Cache v1723.

Tracker Alpha v392 veroeffentlicht, Asset-Upload mit Groesse und SHA-256 verifiziert.
Alpha-Kanal: 50556079 Bytes, SHA-256 `272ee4943b3186cb42dced9de555ea08ed3865b92a7a7041d45c26cf62a0738b`.
Finaler App-Cache v1724. Desktop-Installer und Stable bleiben unveraendert.

### 2026-09-09: Feldtest v392 — zunehmende Latenz und Voice-Abbruch (lokal korrigiert)

Analyse des Runs run-mttnothj-629ac6356c7922 anhand Trackerlog und gespeichertem
Authority-Zustand. Die erste Manifest-Aktion wurde nach 153 ms Trackerzeit
bestaetigt, spaetere nach bis zu 4692 ms. 15 von 33 Manifest-Versuchen hatten
Revisionskonflikte. Die Ankunftsunterschrift benoetigte inklusive erstem
Konflikt rund 10,56 s ab der im Command-ID enthaltenen Clientzeit; ihr
Wiederholungsversuch allein 4389 ms zwischen Tracker-RX und ACK.
Client-/Tracker-Zeitdifferenzen sind damit nur eine Naeherung; RX/ACK liegen
auf derselben Tracker-Uhr.

Bei jedem autoritativen Event wurde neben dem bereits vorhandenen reduce auch
noch der gesamte wachsende Journalverlauf synchron fuer das Shadow-Envelope
abgespielt. Der Tracker erzeugt das Envelope jetzt direkt aus seinem gerade
reduzierten Zustand und fuehrt den bisherigen Trace fort. Externe Bundles,
Handoff und vollstaendiger Replay werden weiterhin geprueft. Journal,
Checkpoint, Duplikatbelege, Persistenz und fachliche Regeln bleiben erhalten.
Ein 165-Event-Test vergleicht die Envelopes gegen vollen Replay auch ueber
Trace-Kuerzung, Checkpoint und Neustart hinweg. Direkter Vergleich mit dem
vorherigen Core fuer das gelieferte Bundle: identisch in compared,
tracker_authority und terminal_release.

Lokaler CPU-Vergleich mit dem gelieferten Checkpoint-Zustand und 60
Fenster-Schliessen-Events, In-Memory-Persistenz: vorher 4812 ms gesamt, nachher
849 ms; letzter Schritt 140,7 gegen 14,0 ms. Dies ist kein MSFS-/Netzwerk-
End-to-End-Messwert und keine Zusage einer festen Feldlatenz.

Boarding-Prewarm war um 05:27:04 UTC fertig. Um 05:30:06 wurde Playback mit
audio_lease_expired endgueltig released: der Audio-Thread konnte seinen
geplanten Stop vor dem JS-Lease-Timer melden. Dieser Pfad ist nun ebenso
retrybar wie der Timer und behaelt Cue-/Voice-Position, statt das Missionsgate
als fertig freizugeben. Die Position wird am tatsaechlich geplanten Stop
begrenzt. Exklusive Wiedergabe und bisherige Lease-Dauer bleiben erhalten.
Gemeinsamer Player und Desktop-Kopie synchronisiert.

Farewell war bereits um 05:35:06 UTC vorgerendert. confirm_unload traf um
05:37:39 ein, wurde um 05:37:42 bestaetigt, Deboarding um 05:37:43 dispatcht.
Verspaetete SimObject-Zuweisungen und Modell-Fallbacks verzögerten danach das
Abholfahrzeug bis 05:37:50; dessen Anfahrtszeit betrug knapp 14 s. Kein Beleg
fuer eine TTS-Generierung als Ursache dieser Abschlussverzoegerung.

Offene Feldbefunde, bewusst nicht als behoben gemeldet:
- Unsichtbares Missionsitem: VFR Multitool Homebase Hardcase Yellow Small,
  erfolgreicher Spawn/Objekt-ID am Start. Geometrie/Bin/Materialdaten vorhanden,
  etwa 24 cm breiter Koffer, keine transparente Materialdefinition. Reale
  Sichtbarkeit/Platzierung am Apron damit nicht nachgewiesen.
- Schwarzer EFB nach Kamerawechsel: keine aussagekraeftige Lifecycle-/Resume-
  Diagnose im Fehlerzeitraum. Umfang des schwarzen Bereichs und installierte
  Community-Version noch zu klaeren; kein spekulativer Lifecycle-Umbau.

98 gezielte Core-, Authority-, Adapter-, Runtime-, Voice-Service- und
Audio-Player-Tests bestanden. Noch nicht ausgerollt, Live weiterhin v392.

### Rollout der Latenz-/Audio-Fixes: v393 / Desktop 1.6.8

Freigegeben am 09.09.2026: Tracker v393, Host-Assetrevision 39301 und manueller
Alpha-Desktop-Installer 1.6.8 (PC-Player ebenfalls korrigiert). 98 Missions-/
Audio-Tests sowie 48 Desktop-Tests bestanden; Host-Assettests ebenfalls gruen.
Installer-ASAR enthaelt nachweislich Version 1.6.8 und den identischen
korrigierten Audio-Player. Realer Windows-Installations-/MSFS-Test steht aus.
Stable-Runtime und globaler Desktop-Autoupdater bleiben unveraendert.
Der Nutzer klaert die komplett schwarze EFB-App separat mit einem anderen
Agenten; Community-Paket/Lifecycle werden hier nicht veraendert.

Release v393 und manueller Alpha-Installer tracker-desktop-v1.6.8 sind auf
GitHub veroeffentlicht, Publisher hat alle Asset-Groessen und SHA-256 geprueft.
Alpha-Zeiger zeigt auf v393. Finaler App-Cache v1726.

Nachgereichte iPhone-Screenshots: Debrief-Abschluss loeste den Tracker-Reset-
Schutz aus. App-Folgefix schliesst nach eindeutig finalisiertem, passendem
Tracker-Run nur die lokale Darstellung. Kein Szenen-/Payload-Reset oder
erneuter Mission-Abbruch; vorhandene neue aktive Runs bleiben geschuetzt.
Standalone-Cleanup behaelt seinen bisherigen Pfad. Ausfuehrbarer Interface-
Regressionstest bestaetigt diese drei Faelle.
Debrief bekommt eine dynamische Viewport-Hoehe, border-box und einen innerhalb
der verfuegbaren Hoehe begrenzten vertikalen Scrollbereich. Browserpruefung mit
langen Inhalten bei 440x894, 440x640, 894x440 und erneut 440x894: Abschlussbutton
erreichbar. Ein realer iOS-Test bleibt erforderlich. Dies betrifft die Web-App;
der separate schwarze EFB beim Kamerawechsel bleibt beim anderen Agenten.

Weitere Performance-Kandidaten (in diesem Release nicht umgebaut):
- Cargo-Szenenwechsel werden je Objekt 180 ms gesammelt; Payload hat ebenfalls
  eine gebuendelte, serielle Schreibqueue. Das rechtfertigt keine 10-s-UI-Latenz.
- PA-24 schreibt mehrere Sitz-/Gewichtsvariablen pro Payload-Abgleich. Delta-
  Writes waeren gegen tatsaechliche Sim-Rueckmeldungen und Standalone zu pruefen.
- deferEffects verwendet Promise-Microtasks: die erste Effektarbeit kann vor
  der aufrufenden ACK-Fortsetzung anlaufen. Ein echtes Event-Loop-Yield ist ein
  moeglicher naechster gezielter Schritt, ohne ACK oder Side-Effect-Durabilitaet
  zu veraendern. Nicht durch Entfernen der Revision-Gates parallelisieren.
- UI-Revisionskonflikte werden durch technische ACKs beguenstigt; im Feld 15/33
  Manifest-Versuche. Nach beseitigtem Replay zuerst neu messen, bevor ein
  weiterer Versions-/Synchronisierungsmechanismus hinzugefuegt wird.

### v394-Kandidat: Cargo-Buendelung, freier Audio-I/O und Arrival-Paritaet (09.09.2026)

Umgesetzt auf Grundlage des v393-Feldtests `run-mttqnej8-ffc82e6a6b839b`:
- Ein Cargo-Klickpaket statt einzelner serieller Relay-Roundtrips, mit sofortiger
  Pending-Anzeige und gemeinsamer Revision in App und gehostetem EFB-View.
  Additive Capability `mission.cargo-batch.v1`; Standalone/alte Tracker bleiben
  auf dem Einzelpfad. Simulator-Objekte bleiben unabhaengige Effekte, Payload
  wird einmal fuer den gemeinsamen Manifeststand geschrieben.
- Kein zweiter Cargo-Sammel-Timer fuer bereits im Client gebuendelte Pakete.
  Der Deferred-Effect-Start gibt den Eventloop fuer das dauerhafte Intent-ACK
  frei, bevor Sim-Effekte anlaufen.
- Voice-Cache asynchron, atomar und zusammengefasst; vorhandenes v1-Format
  bleibt erhalten. Keine erneute Base64-Kodierung alter Audio-Buffer bei jedem
  Cargo-Cue, Aktivieren oder Playback-Release.
- Arrival-Freigabe wie Standalone: am Boden, <=2 kt oder Parkbremse, ohne
  zusaetzliche drei Sekunden. Gewoehnliche Cargo-Gewichtsaktualisierungen
  sperren keine Ankunftsunterschrift/Entladebestaetigung mehr. Departure-Gates,
  PAX-Sequenz, Farewell und finale Payload-Freigabe bleiben bestehen.
- Der regulaere Asset-Build uebernimmt den bereits vorhandenen Debrief-
  Scrollfix aus styles.css auch ins gehostete EFB-Stylesheet. Kamerawechsel/
  schwarzer EFB bleibt im gesonderten Arbeitsauftrag.

Lokaler Vergleich mit 24 MiB fertigem Audio im Cache, drei Durchlaeufe:
Cargo-Cue bereit vorher 114,4–157,1 ms, nachher 0,3–1,0 ms; Verzoegerung eines
Eventloop-Timers vorher 115,9–157,3 ms, nachher 5,5–9,0 ms. Das misst den
Cachepfad auf macOS, keine reale MSFS-/Relay-End-to-End-Latenz. Verspaetete
SimObject-Zuweisungen koennen weiterhin ausserhalb dieses Pfades entstehen.

Regressionen pruefen atomare Batch-Ablehnung, Revisionskonflikte, Replay,
alle Objekt-/Audio-Effekte, nur einen Payload-Write einschliesslich mehrerer
geerbter Bordbestand-Items, Queue-Barrieren, alte Tracker, langsame/fehlerhafte
Cache-I/O und Arrival-/PAX-/Abschluss-Gates. Der Cargo-Persistenz-Selbsttest
bindet fuer seinen Bordbuch-Kontext jetzt den bereits verwendeten Manifest-
Core ein; Produktlogik der Standalone wurde nicht geaendert.

Validierung: 147 gezielte Node-Tests bestanden, dazu Interface-, Flow-,
Ground-, Cargo-Persistenz-, Payload-Differential- und Update-Sync-Selbsttests
sowie Manifest-/Payload-/Location-Core-Tests. Syntax und Whitespace geprueft.
Windows-x64-EXE v394 erfolgreich gebaut (50.567.155 Bytes), SHA-256:
`3431c0efde390f3ba4d833f5a5ee1be516bbd5699af6717e39eda66fe2d934a1`.
EFB-Assetrevision des Kandidaten: 39401.

Noch kein Rollout: Live bleibt v393 / App SW v1726 / Desktop 1.6.8.


### Rollout v394: Cargo-Performance und Arrival-Paritaet (09.09.2026)

Freigegebener Code-Commit: `c5270b336`, unveraenderlicher Release `v394`.
Der Publisher hat Groesse und GitHub-Digest des EXE-Assets geprueft; danach
wurde der oeffentliche Download separat vollstaendig gehasht und bestaetigt
(50.567.155 Bytes, SHA-256 wie beim Kandidaten oben).
Alpha-Kanal wird auf dieses Artefakt gesetzt, App-SW auf `ga-dispatcher-v1727`.
EFB-Hostrevision: 39401. Desktop 1.6.8 verwendet seine vorhandene getrennte
Alpha-Runtime-Aktualisierung; kein neuer Installer und keine Aenderung des
Stable-Kanals. Der reale Standalone-/MSFS-Latenzvergleich bleibt der naechste
Feldtest. Kamerawechsel/Black-Screen bleibt beim separaten Arbeitsauftrag.

### Feldtest v394: fehlende Arrival-Szene und verbleibende Latenzen (09.09.2026, Kandidat)

Neue Logs: `mission-mttu44rg-gzjsq6`, Run `run-mttux9ii-963f461c4b6a64`,
08:49–09:03 UTC. Noch kein Rollout dieser Korrekturen.

Belegte Ursachen und gezielte Korrekturen:

- `set_boardbook_time` scheiterte am Cockpit-Transport-Allowlist-Eingang
  (`mission_intent_not_allowed`, 08:52:32.670 UTC), obwohl der Adapter und die
  UI den Intent kennen. Bordbuch und ebenfalls implementiertes
  `replace_equipment` sind jetzt fuer authentifizierte HTTP- und Relay-Intents
  zugelassen; die bestehenden fachlichen Adapter-Gates gelten weiter.
- Der APT-Effektplan enthielt ueberhaupt keine statische Ankunftsszene. Die App
  sperrt ihren eigenen Spawn im Trackerbetrieb korrekt. Der gemeinsame
  bisherige Command-Builder liefert jetzt auch `scene.arrival` im Effektplan;
  `MISSION_STARTED` fordert den Effekt bei vorhandenem Plan einmal an. Die
  Bridge behaelt Zielkoordinaten/Assets/Placement aus dem Plan statt die
  aktuelle Flugzeugposition einzusetzen. Alte Plaene ohne dieses Feld bleiben
  kompatibel, erhalten aber keine erfundene Zielszene. Fuer den naechsten Test
  muss die aktualisierte App einen neuen Run samt neuem Effektplan uebergeben.
- Revisionskonflikte nach Cargo-/Sound-/Payload-ACKs erzeugten mehrere
  Netzwerkrunden; zweimal scheiterte auch der zweite Versuch. Der Tracker
  merkt sich fuer maximal 128 gelesene Revisionen den semantischen
  Bedienstand (Manifest inkl. Signatur, Phase, Flags, Fortschritt, Workflows,
  Flugzeiten und erlaubte Aktionen). Nur bei identischem Stand darf eine
  kleine Allowlist von Boden-/Bordbuch-Intents gegen die aktuelle Revision
  validiert werden. Unbekannte Revisionen, geaenderte Items/Signaturen/Gates,
  Runwechsel und Start/Abort bleiben strikt. Keine blinde Wiederholung und
  kein Abschalten der CAS-Pruefung. Nach Neustart ist die Historie leer.
- Der ACK des bereits unterschriebenen und bestaetigten PAX-Handoffs
  invalidierte die Ankunftssignatur als vermeintliche neue Cargo-Aenderung.
  Dieser spezielle Abschluss behaelt die Signatur. Manuelle Cargo- und
  PAX-Aenderungen invalidieren sie weiterhin; die Departure-Gates bleiben.
- Wiederholte Telemetrie-/UI-Abfragen normalisierten denselben immutable
  Reducer-State mehrfach und berechneten einen nicht ausgegebenen
  Flugabschlussbericht schon waehrend des Fluges. Normalisierte Projektion
  und View werden nun nach State-Identitaet gecacht und nach aussen kopiert;
  der Abschlussbericht entsteht nur in Abschlussphasen. Die atomare
  Authority-Datei wird kompakt geschrieben, weiterhin vor dem Erfolgs-ACK.
- Beim Wechsel auf Relay stoppt die App Heartbeats einer inzwischen
  ungueltigen lokalen Cockpit-Sitzung; bei Rueckkehr wird neu registriert.
- Cargo-Audio wartet wie Boarding/Farewell zunaechst auf eine echte Claim-
  Bestaetigung. Ohne Claim wird der Cue verworfen/protokolliert, statt zwei
  Minuten nachfolgende Cues und die finale Effect-Abrechnung zu blockieren.

Grenzen / Diagnose:

RX→Intent-ACK im selben Tracker-Log: erfolgreiche Befehle 76–847 ms.
Ein Verbandkasten-Spawn lief 08:59:37.882–09:00:03.657 UTC durch vier
SimConnect-Timeouts; die vorhergehende Intent-Verarbeitung dauerte 567 ms.
Mehrere Relay-Verbindungen brachen ab. PA-24-Payload-Warnungen zeigen
Seat3/Seat4Character und Sitzgewichte, die dem Zielzustand widersprechen.
Diese Daten beweisen keine Hardwareursache und erklaeren nicht allein,
weshalb SimConnect und Telemetrie zeitweise aussetzen.

`TRACKER_TELEMETRY_DELAY` misst bei Auffaelligkeiten Eventloop-Verzoegerung,
Abstand zum letzten Sim-Datenpaket, lokale Verarbeitungsdauer und
WebSocket-Sendepuffer (hoechstens alle zehn Sekunden). Separat weist
`MISSION_AUTHORITY_PERSIST_SLOW` langsame JSON-/Dateischreibzeiten aus.
Keine kuenstlichen GPS-Updates und kein Ausblenden von Verbindungsfehlern.

Lokaler Lesevergleich mit dem zuvor bereitgestellten Authority-Datensatz,
200 Paare aus internem und oeffentlichem Snapshot: Median vorher 1,74 ms,
nachher 0,52 ms; insgesamt 372→115 ms. Das ist ein enger macOS-Mikrobenchmark,
kein Beleg fuer beseitigte Sekundenpausen im Windows/MSFS-Feldtest.

Validierung: 117 gezielte Tests zu Core, Authority, Adapter, Runtime,
Effect-Runner, Cockpit und Simulator-Bridge; weitere 14 Audio-Tests.
Interface-Selbsttest fuehrt den echten App-Effectplan-Builder aus und
vergleicht den Arrival-Command mit dem gemeinsamen Standalone-Builder.

Zusaetzlich bestanden: Flow-Simulation, Ground-Flow, Cargo-Persistenz,
Payload-App-Differential, Standalone-Cargo-UI-Charakterisierung und Cargo-
Audio-App-Differential. EFB-Assets synchronisiert; Syntax/Whitespace sauber.
Live bleibt v394 / SW v1727; kein EXE-/Channel-/Origin-Rollout in diesem Schritt.

### Release-Kandidat v395 (09.09.2026)

Tracker v395, gehostete EFB-Assets 39501 und App-Cache v1728 enthalten die
oben beschriebenen Feldtest-Korrekturen. Die Windows-EXE wurde erfolgreich
gebaut (50.574.090 Bytes, SHA-256
`b2f1c237c44d5c2c5f5469acfaa4dc0b3674be7af625f1a89923b7bcaa3d7477`).
Zusaetzlich bestanden alle 17 EFB-Web-Tests nach dem Versionswechsel.
Desktop 1.6.8 und die Stable-Kanaele bleiben unveraendert. Der Alpha-Kanal
wird erst nach verifiziertem Release-Upload umgestellt. Der naechste
MSFS-Feldtest bleibt fuer die Telemetrie-Diagnose erforderlich.

### Alpha-Rollout v395 (09.09.2026)

Source-Commit `2f5d7edac` und unveraenderlicher Tag `v395` auf Origin.
GitHub-Release und EXE-Upload sind nach Dateigroesse und GitHub-SHA-256
verifiziert. `channel/alpha.json` zeigt auf genau dieses Artefakt;
der abschliessende App-/Kanal-Push verwendet Cache v1729. Stable-Runtime,
Desktop-Installer und EFB-Community-Package bleiben unveraendert.

### Vergleichstests vom 09.09.2026, 13:20–13:36 (v395, lokale Nacharbeit)

Die Datei `standalone ga-tracker-debug.txt` enthaelt beide neuen Laeufe:
Tracker-Authority `mission-mtu0bgrd-bnk30j` / `run-mtu0cy8j-fb014ffdeaa078`
(11:21–11:27 UTC), danach Web-Authority `mission-mtu0nf8l-4d3czz`
(11:30–11:35 UTC). Die als Tracker bezeichneten Dateien enden dagegen noch
beim vorherigen Lauf um 09:03 UTC. Die Zuordnung erfolgt anhand der Intents,
ACKs und Missions-IDs; die beiden App-Diagnosen passen zu den neuen Laeufen.
Es sind unterschiedliche Missionen/Assets, kein identischer Modell-Benchmark.

Befunde:

- Neue Telemetriediagnose: Tracker-Lauf maximal 981 ms Verarbeitungsdauer und
  4397 ms Eventloop-Verzoegerung; Standalone maximal 32 ms beziehungsweise
  2041 ms in den protokollierten Auffaelligkeiten. Der Relay-Sendepuffer ist
  jeweils leer. Dies beweist lokale Verzoegerung, aber keine reine PC-Ursache.
- Erfolgreiche Intent-Verarbeitung selbst liegt in diesen Logs meist im
  niedrigen dreistelligen Millisekundenbereich. Einzelne Befehle treffen
  dagegen bereits mehrere Sekunden nach dem Command-ID-Zeitstempel ein
  (Geraeteuhren/Transport und lokale Verarbeitung dabei getrennt betrachten).
- Cargo-Spawn 11:24:31.534–11:24:47.358 UTC scheitert nach Modell-/SimConnect-
  Fehlern. Solche Wartezeiten duerfen weder UI noch andere Items blockieren.
- Tracker startet am Ende ein neues Fahrzeug (`pickupBound=0`); Standalone
  bindet das bereits vorhandene Arrival-Fahrzeug (`pickupBound=1`).
- PA-24-Tuerpfad und Werte sind in beiden Laeufen identisch: Handle open=1,
  close=0, Latch unlock=0, lock=1, 900/3000 ms. Keine Aenderung dieser Werte
  durch v395. Die visuell gemeldete Inversion ist damit noch nicht erklaert;
  keine Polaritaetsaenderung ohne eindeutigen Sim-Nachweis.

Lokale Korrekturen:

- Rohfluglog-Append aus dem synchronen Telemetriecallback entfernt; begrenzte,
  geordnete asynchrone Schreibqueue mit sichtbaren Fehlern.
- Voice-Abfragen im Telemetriepfad kopieren nur den Effektplan statt den
  gesamten Seed/Replay. Runtime-Projektionen werden nach unveraenderter
  Kontext-Identitaet gecacht, oeffentliche Antworten bleiben abgetrennt.
- Unabhaengige Cargo-Items koennen trotz vorhergehendem Item-Commit ohne
  zusaetzliche Konfliktrunde angenommen werden. Geaenderte Ziel-Items,
  Signaturen oder fachliche Gates bleiben geschuetzt.
- Nahe, erfolgreich gespawnte Arrival-Szene wird beim Deboarding gebunden;
  die bestehende Sim-Logik prueft das Fahrzeug und behaelt ihren Fallback.

Lokaler macOS-Lesevergleich am bereitgestellten Authority-Datensatz, 300
Durchlaeufe: bisher 694 ms / Median 2,205 ms, Kandidat 236 ms / Median 0,731 ms.
Kopierte Daten beim Planlesen 242359→51595 Zeichen. Kein End-to-End-Sim-PASS.
108 gezielte Core-/Authority-/Cockpit-/Runtime-/Scene-/Flightlog-Tests bestanden.
Zusaetzlich Interface-, Flow-, Ground-, Cargo-Persistenz-, Payload-App-,
Standalone-Cargo-UI- und Update-Sync-Selbsttests bestanden. Slow-I/O-Test haelt
Datei-ACKs absichtlich offen und prueft nichtblockierende Annahme, Reihenfolge
und Fehleranzeige; Szenentest prueft bestaetigt/fehlgeschlagen/zu weit entfernt.
Noch nicht ausgerollt; live bleibt Tracker v395 / App-Cache v1729.

### Bereinigung und Release-Kandidat v396 (09.09.2026)

Die lokalen Vergleichsfixes oben werden mit einer gezielten Bereinigung
veroeffentlicht: Raw-Telemetrielogs schreiben asynchron und geordnet; die
Mission-Authority bleibt vor dem Intent-ACK atomar gespeichert. Unabhaengige
Cargo-Items koennen auf einer bekannten Revision weiterbearbeitet werden;
Aenderungen am betroffenen Item, an Signaturen und Phasengrenzen bleiben
Konflikte. Deboarding bindet am bestaetigten nahen Ziel die vorhandene Szene.

Runtime, Adapter und Simulator-Effektbruecke lesen fuer Effektplaene nicht
mehr das vollstaendige Missionspaket. Flugplatzbezeichnungen haben einen
kleinen getrennten Zugriff. Zusammengehoerige Telemetriepruefungen verwenden
einen lokalen Snapshot und lesen ihn nach neu erzeugten Flug-Voice-Events
frisch; die Effekt-Historie wird in einem Durchgang ausgewertet. Payload-,
Voice- und Szenen-ACKs benutzen dieselbe Nachbearbeitung mit Drain,
Checkpoint, Auto-Close-Pruefung und Finalisierung. Der Voice-Checkpoint wird
nun wie bei den anderen ACKs nach dem Drain geschrieben.

Standalone-Deboarding und Tracker-Template benutzen denselben Command-Builder.
Die Standalone-Gates und die Bestimmung des vorhandenen Ziel-Fahrzeugs bleiben
unveraendert. Der neue Differentialtest hat 384 Konfigurationen gegen den
unveraenderten vorherigen sync.js-Stand verglichen: identische Befehle und
Standalone-Statusaenderungen (Pax 0/1/5, Geschlecht, Fahrzeug-Asset,
Arrival-Status, Entfernung, Spawnfehler und Farewell-Koordination).

Validierung: 108 Core-/Authority-/Runtime-/Effekt-/Flightlog-Tests, 16 lokale
EFB-HTTP-Tests, 25 Manifest-/Payload-/Location-Tests und 14 App-/Flow-/UI-
Selftests bestanden. Ein bestehender Ground-Flow-Quelltest folgt jetzt dem
extrahierten Builder; der HTTP-Test prueft Versionskonsistenz statt der
ueberholten Festzahl v389. Windows-EXE mit pkg erfolgreich gebaut.

Kandidat: Tracker v396, App-Cache v1730. Desktop 1.6.8, EFB-Paket und
gehostete EFB-Assetrevision 39501 benoetigen keine Aenderung. Stable bleibt
unveraendert. Kein realer MSFS-Latenznachweis aus diesem Build: Spawnfehler
und die gemeldete Tuer-Inversion sind damit nicht als behoben bestaetigt.

### Alpha-Rollout v396 (09.09.2026)

Source-Commit `8783b672f`, Tag `v396` und Tracker-EXE auf Origin veroeffentlicht.
Der Publisher hat die Assetgroesse 50.580.714 Bytes und SHA-256
`3a2ad94c9bdcf3954052cd73969fc569c9ea1e0cdbb9d19bfd5211d626cc8fc7`
vor der Veroeffentlichung verifiziert. Der Alpha-Zeiger verwendet exakt dieses
Artefakt; sein abschliessender Origin-Push erhoeht den App-Cache auf v1731.
Stable, Desktop-Installer und EFB-Paket bleiben auf ihren bisherigen Staenden.

### v396 Feldtest: erster Cargo-Klick und veralteter Farewell (09.09.2026, lokal)

Run `run-mtu2q2xh-774d8709d45b74`, Mission `mission-mtu2p59v-tvwo9b`:
Farewell-Prewarm um 12:30:17 UTC, TTS fertig 12:30:27 UTC; Entladung folgte
spaeter. Die gespeicherte Ansage behandelte das noch geladene Serumpaket als
nicht geliefert. Dispatch aktivierte den fertigen Prewarm ungeprueft. Der
App-Abschluss um 14:32:25 Ortszeit meldete dagegen `failed:false` und keine
fehlenden/nicht gelieferten Pflichtgegenstaende. Der Widerspruch lag in der
vorbereiteten Ansage, nicht im abschliessend verbuchten Cargo-Ergebnis.

Lokale Korrektur: Prewarm prognostiziert die normale Uebergabe bereits
mitgefuehrter Zielladung auf einer privaten, zuvor stressbewerteten Kopie.
Fehlende, verlorene und beschaedigte Items werden nicht gesundgerechnet.
Dispatch verwendet wieder den realen Manifeststand und reicht sein aktuelles
Rezept bei der Voice-Service-Deduplizierung ein. Ein geaenderter Inhalt
verwirft den stillen Prewarm und nutzt die aktuelle Effekt-ID; ein identischer
Inhalt wird wiederverwendet. Der feste negative Ersatztext in Core und
App-Fallback nennt das konkrete Problem in kurzen vollstaendigen Saetzen;
Rollenfloskeln, Abschlussbericht-Hinweis und pauschale Neustartaufforderung entfallen.
Die Standalone-Missionsregeln bleiben unveraendert.

Die gemeinsame Tracker-Intentqueue sendet den ersten Cargo-Klick ohne
Sammelwartezeit. Folgeklicks innerhalb von 180 ms starten ein 500-ms-
Ruhefenster, das jeder weitere kompatible Klick erneut verlaengert. Wie in
der Standalone-Payloadqueue wird nach maximal zwei Sekunden abgesendet.
Signatur, andere Aktionen sowie Missions-/Phasenwechsel bleiben Barrieren.
Die bestehende Batch-Capability markiert auch einen einzelnen gesendeten
Eintrag als coalesced, sodass die Sim-Effektbruecke keine weiteren 180 ms
wartet. Der bestaetigte Zustand kommt weiterhin ausschliesslich vom Tracker.

Validierung: 100 Node-Tests plus sechs App-/Flow-/Interface-Selftests bestanden.
Abgedeckt sind sofortiger erster Klick, gebuendelte Folgeklicks, erneuter
Einzelklick nach Ruhe, verlaengertes Ruhefenster mit Zwei-Sekunden-Grenze,
Reihenfolgegrenzen, Prewarm ohne Zustandsmutation,
echte fehlende/beschaedigte Ladung und korrigierte Ansage in beiden Richtungen
(Fehler zu Erfolg und Erfolg zu Fehler). Release-Kandidat: Tracker v397,
App-Cache v1732; Alpha-Zeiger folgt erst nach verifiziertem Release-Upload.


Release v397: Source-Tag `566dbb4c8`, Windows-EXE gebaut und oeffentlicher
Download bytegleich verifiziert (50582378 Bytes, SHA-256 `bc40ae04cea098ba078ced61d3b6cd4142509c6913ff2d02e69e5ea7fe7e9cb8`).
Alpha-Zeiger v397 und App-Cache v1733; Stable und Desktop-Bootstrapper unveraendert.


### v397 Feldtest: Bordbuch-Erinnerung, Deboarding-Label und Fremdobjekt-Logs (lokal)

Die App projiziert Start-/Landezeit-Erinnerungen jetzt aus den bestaetigten
Tracker-flightEvents in das bestehende Bordbuchbanner. Sie erzeugt dabei
keine lokalen Flugereignisse und sendet keinen neuen Telemetrieverkehr.
Pro Mission/Run/Flug/Ereignis wird die Erinnerung einmal angezeigt; bereits
gefuellte Eintraege, fehlender Bordbestand und geschlossene Runs bleiben still.
Der Cargo-Hauptbutton nutzt denselben deboardingBusy-Zustand wie die PAX-Zeile
und ist waehrend der Animation als „Deboarding läuft …“ gesperrt. Der bestehende
bestaetigte Auto-Abschluss zum Debrief bleibt unveraendert.

Beim Feldtest am 09.09.2026 um 14:03:08 UTC meldete der Tracker 8069 ms
Event-Loop-Verspaetung, 984 ms letzte Telemetrieverarbeitung und einen leeren
Relay-Sendepuffer. Davor standen zahlreiche HOMEBASE_OBJECT_REMOVED-Zeilen
ohne eigene Objekt-ID; deren Debuglogger schreibt synchron. Diese nutzlosen
Fremdobjekt-Meldungen entfallen nun, waehrend eigenes Object-/ACK-Cleanup
unveraendert bleibt. Eine Authority-Speicherung dauerte im selben Zeitraum
738 ms. Die Loglast ist ein nachgewiesener unnoetiger Schreibpfad, aber kein
vollstaendiger Kausalnachweis fuer alle acht Sekunden. Das 500-ms-Relayintervall
bleibt unveraendert; weitere Verbesserung anhand des naechsten Feldlogs.

Validierung: 27 UI-/Queue-Tests, Tracker-Interface-Regression mit echtem
Bordbuchbanner und Homebase-Selftest bestanden. Fremdobjekt-Burst mit 1000
Entfernungen erzeugt keine Debug-Schreibaufrufe; eigene Entfernungen bleiben
protokolliert und bestaetigt. Noch nicht ausgerollt.

### APT-Paritaet: Abschluss-Recovery, Rueckfrage und Reconnect (09.09.2026, lokal)

Der Tracker leitet die automatische Fortsetzung nach `confirm_unload` jetzt
aus dem gespeicherten `unloadConfirmed` und den bestehenden erlaubten Aktionen
ab. Der fluechtige Zusatzmerker entfaellt. Ein Neustart zwischen bestaetigtem
Intent und Effektverarbeitung setzt denselben Ablauf mit stabiler Command-ID
fort. Ist der letzte Close-ACK bereits gespeichert, wird der geschlossene Run
beim Wiederverbinden finalisiert. Farewell, Deboarding und Payload behalten ihre
ACK-Gates; ein noch nicht bestaetigtes Entladen wird nicht automatisch beendet.

Die Smartphone-App nutzt vor dem Tracker-Intent dieselbe vorhandene
`cargo-end`-Rueckfrage wie Standalone und EFB. Abbrechen sendet keinen Intent;
bereits bestaetigte interne Fortsetzungen fragen nicht erneut. Nach der
Animation bleibt der automatische Wechsel zum Debrief bestehen.

Beim Relay-Reconnect ueberspringt ein Tracker-Interface den alten
Lifecycle-Wiederanlauf. Zusaetzlich prueft der zentrale Legacy-Sender die
Authority unmittelbar vor dem Versand, auch bei einem Wechsel waehrend des
asynchronen Handshakes. Standalone behaelt seinen bisherigen Lifecycle-Pfad.
Es gibt keine neuen Timer, Datenfelder oder Aenderungen am 500-ms-Intervall.

Nachweis: Persistenter Neustart vor/nach Entladebestaetigung und nach finalem
Close-ACK, unveraenderte Farewell-/Deboarding-ACK-Reihenfolge, kein doppelter
Abschluss, echte App-/EFB-Handler fuer Zustimmung/Abbruch und Reconnect mit
Authority-Wechsel. Die vorher reproduzierten Wiederanlauf-Luecken sind damit
automatisiert abgedeckt. Ein erneuter MSFS-Feldtest steht aus; nicht ausgerollt.


### Tracker-Navigationswarnungen und Daten-Cache (09.09.2026, lokal)

Beschluss: Luftraum-/TAWS-Ausloeser laufen im Tracker, damit EFB/PC ohne
geoeffnete Web-App warnen koennen. Wegpunktansagen lesen die gespeicherte
Missionsroute. Die bestehende Standalone bleibt Referenz; keine geaenderten
Luftraumklassen, Sicherheitsabstaende oder Missionsregeln. Die gemeinsame
Warnlogik ist jetzt ein reiner Core, den die Standalone ebenfalls verwendet.

Der Tracker liest OpenAIP-Packs, Core-Hindernisse und Terrarium-Hoehen selbst
und cached sie bis 4 GiB unter `navigation-cache` im Datenordner. Downloads
sind asynchron, dedupliziert und auf vier begrenzt, RAM-Tiles ebenfalls
begrenzt. Hindernisdaten stehen zur Verfuegung; es wurde keine zusaetzliche
Hindernis-Kollisionsregel erfunden. Fehlende Daten erscheinen als unvollstaendig.

PC/App-Auswahl und dieselbe Wiedergabequeue gelten fuer PAX, Mission-Cues und
Warnungen. Passenger-Voice geht vor; Warnsequenzen werden nach einer
Unterbrechung fortgesetzt, sofern nicht veraltet. Feste Warnclips laufen
ueber lokalen HTTP-Cache/GitHub, nicht als Audio-Chunks durch den Relay.
Warnstatus und Lease-Steuerung bleiben kleine synchronisierte Nachrichten.
Das 500-ms-Telemetrieintervall wird nicht geaendert. Neue Warn- und
Stimmenwahl ist auch direkt in Desktop/EFB erreichbar. Alte Desktop-Player
werden durch eine eigene Capability geschuetzt und behalten den bisherigen
Pfad. Die Aktualisierung braucht daher auch ein Desktop-Update.

Validierung: Differentialtest gegen eingefrorenen Standalone-Luftraumcode;
Terrain-Schwellen, Frequenzclips und Wegpunktlinie; Voice-Prioritaet,
Fortsetzung ohne Ueberlappung, Ablauf, Geraetewahl und Relay ohne Audio-Chunks;
Cache-Deduplizierung, Groessenbegrenzung, atomare Validierung und Offline-
Neustart; Tracker-Ausloeser ohne App, verspaetete Daten, Reset/Legacy-Handoff,
fehlende Daten und gespeicherte Route. App/EFB pruefen doppelte/veraltete
Warnungen und lokale Queue-Bereinigung. Coherent-Syntaxtests decken auch
Audio-Adapter, Player und Client ab.

Realer Datenprobeabruf Lahr/Offenburg: 493 ft am Punkt 48.38/7.84,
17 Luftraeume und 34 Hindernisse. Nach Neustart mit absichtlich gesperrtem
Netzwerk gleiche Hoehenwerte und Datensatzanzahlen, acht Cachetreffer, null
Downloads; lokaler Datenbestand 2.53 MB. Dies belegt die Datenanbindung,
keine neue Hoehenvermessung oder erfolgreiche Simulatorwarnung.

Abschlusspruefung: 146 Node-Tests sowie AWM-Queue-, Terrain- und Tracker-
Interface-Selftest bestanden. Gemeinsamer Player, Clip-Adapter und Katalog
sind in Desktop und Quelle identisch. Ein unveroeffentlichter Windows-EXE-
Testbuild mit der neuen PNG-Abhaengigkeit wurde erfolgreich erzeugt.

Noch nicht ausgerollt. Live bleiben Tracker v397, App-Cache v1733 und
Desktop 1.6.8. Fuer den Rollout sind Tracker-EXE und Desktop neu zu bauen;
der anschliessende iPhone-/EFB-/PC-Feldtest bleibt erforderlich.

### EFB-Verbindungserholung und Flugbahn-Abdeckung (09.09.2026, lokal)

Die nachfolgende Codepruefung reproduzierte drei Luecken: Ein haengender
Checklisten-/Kartenabruf hielt auch die bereits fertige Telemetrie zurueck;
lokale Audio-/Controller-Anfragen konnten ohne Deadline stehen bleiben;
Luftraumdaten wurden nach einem Kurswechsel noch bis zum alten Zeit-/Distanz-
Intervall aus dem falschen Korridor genommen und als bereit angezeigt.

Der Host aktualisiert Flugzeugdaten nun unabhaengig von Status, Karte und
Checklisten. Flugzeug-Polling bleibt bei einer Sekunde, der Tracker-Relay bei
500 ms. Checklisten werden separat alle zehn Sekunden gelesen. Eine gemeinsame
HTTP-Deadline umfasst Antwortheader und JSON-Body und verwirft verspaetete
Antworten auch ohne AbortController in Coherent. Telemetrie und zentrale
Audio-Steuerung haben 2.5 Sekunden, Missions-/Nebenabfragen 5 Sekunden,
Controller-POSTs 10 Sekunden und Kartenkontext-Abfragen 15 Sekunden Zeit.
Abgelaufene schreibende Intents werden nicht blind wiederholt; der Tracker-
Snapshot bleibt die Wahrheit. Der Audio-Player gibt haengende Steueranfragen
frei und versucht den Queue-Abruf nach einer Sekunde erneut, ohne neue
Benutzeraktion. Playback-Lease und PAX-Prioritaet bleiben erhalten.

Warnungen verwenden weiterhin die Standalone-Flugbahn: aktuelle Position und
Richtung, GS/VS mit EMA 0.3, Vorhersagepunkte bei 1/2/3/4/5/10 Minuten und den
TAWS-Feinpunkt bei 15 Sekunden. Geplante Wegpunkte ersetzen diese Flugbahn
nicht. Datenanbieter und Runtime verwenden dieselben Abdeckungsgrenzen.
Verlaesst die aktuelle Vorhersage die geladenen Grenzen, wird sofort
nachgeladen; bei Fehlern begrenzt ein Zehn-Sekunden-Backoff Wiederholungen.
Bis zur vollstaendigen aktuellen Abdeckung meldet der Dienst unvollstaendige
Luftraumdaten. Antworten von vor einem deutlichen Kurswechsel erzeugen keine
Ansage fuer die alte Richtung. Bereits am Boden werden lokale Terrain- und
Luftraumdaten geladen; Luftraum-/Terrainwarnungen bleiben wie bisher oberhalb
30 kt aktiv.

Validierung: 169 unterschiedliche Node-Tests einschliesslich HTTP-/Desktop-
Schnittstellen, Coherent ohne AbortController, haengender Header/Body,
spaeter Antworten, automatischer Audio-Erholung, getrenntem EFB-Polling,
Kurs-/Geschwindigkeitsaenderung und Vorladen am Boden bestanden. Die
Vorhersagekoordinaten werden gegen die echte Standalone-Funktion in app.js
verglichen, die Luftraumentscheidungen gegen den eingefrorenen
Standalone-Detektor. AWM-Queue- und Tracker-Interface-Selftest sind gruen.
Der abschliessende lokale Windows-Testbuild wurde erfolgreich erzeugt
(51,427,582 Bytes); Desktop-Kopie und Player-Quelle sind identisch.

Keine Veroeffentlichung in diesem Schritt. Das vollstaendige EFB-Debrief
bleibt der separat dokumentierte Ausbaupunkt; der reale Sim-/EFB-/iPhone-
Nachweis der neuen Verbindungserholung und Warnungsabdeckung steht noch aus.


### Alpha-Rollout: v398 / Desktop 1.6.9 (09.09.2026)

Rollout umfasst die oben beschriebenen APT-Paritaetskorrekturen, Navigation mit
Flugbahnpruefung und lokalem Daten-/Audiocache sowie entkoppelte EFB-Abfragen
mit verbindlichen Deadlines und automatischer Wiederaufnahme. Tracker v398,
EFB-Hostassets 39801, Web-App-Cache v1734. Der Relay-Takt bleibt bei 500 ms.

Auf Nutzerwunsch bekommt Desktop 1.6.9 eigene aufklappbare Bereiche fuer Konto,
Audio und App-Update. Diagnose und Engine-Einstellungen bleiben beim Tracker.
Der App-Updatestatus hat ein eigenes Badge und ueberschreibt nicht mehr den
Trackerstatus. Fehlende Zugangsdaten oeffnen weiterhin direkt das passende
Formular. Der Alpha-Downloadlink verweist auf den manuellen 1.6.9-Installer.

169 gezielte Navigations-/EFB-/Audio-/Desktop-Tests wurden zuvor bestanden.
Zur Releasevorbereitung erneut: 48 Desktop-, 45 Missions-/APT-UI- und 18
Host-Asset-Tests sowie AWM-Queue- und Tracker-Interface-Selbsttests bestanden.
Isolierte Electron-Pruefung mit echten HTML/CSS/Renderer-Dateien bestaetigt
Panel-Zuordnung, automatisches Oeffnen von Konto, Tastaturfokus und Aufklappen
ohne horizontalen Ueberlauf. Screenshots visuell geprueft.

Runtime v398 und manueller Desktop-Installer tracker-desktop-v1.6.9 sind als
unveraenderliche GitHub-Releases veroeffentlicht. Uploads und oeffentliche
Downloads von EXE, Installer, Blockmap und Metadaten sind gegen die lokalen
Builds verifiziert. Der Installer-ASAR enthaelt die exakten geprueften UI-,
Audio- und Prozessdateien. Alpha-Zeiger und App-Downloadlink sind aktualisiert.

- Runtime: 51.427.502 Bytes, SHA-256
  `0a8d5cfd990e29a780207080c31b4c6a551798a02e0e508a1f7161f867b9ad40`.
- Desktop-Installer: 100.272.318 Bytes, SHA-256
  `dab29e6bce53cd0c1dbbdcced462fb85c7d7d6407121b9bce9d6a0acc3876c45`.

Runtime-Stable, globaler Desktop-Autoupdatezeiger und EFB-Community-Paket bleiben
unveraendert. Fuer die neuen Warnungen Desktop 1.6.9 einmal manuell installieren
und den Alpha-Kanal mit APT-Tracker-Steuerung verwenden. Reale Windows-Installation
und MSFS-Flugtest stehen aus.

### Korrekturen aus dem v398-Flugtest (10.09.2026, noch nicht ausgerollt)

Befunde aus App-/Tracker-Logs und dem Screenshot vom 10.09.: Die App zeigte
ungeformte Warntexte, der EFB-Host hatte keinen passenden Warnrenderer. Der
Frequenz-/Bordbuchcontainer lag ausserdem innerhalb der beschnittenen Karte
bzw. hinter dem Vollbildoverlay. Beide Ansichten benutzen jetzt die ausgelagerte
Standalone-Praesentation (Namen, Farben, Frequenzen/Squawks, Dismiss und dreifaches
Polygon-Pulsieren). Der gemeinsame Bannerhost liegt ausserhalb der Karte, ueber
deren Vollbildoverlay und unter Dialogen. Der EFB hebt passende Profilsegmente
mit hervor. Geometrie wird pro aktiver Warnung bei Bedarf in begrenzten Chunks
abgerufen, nicht in jedes 500-ms-Telemetriepaket aufgenommen. Ein noch nicht
bereiter Renderer verbraucht keine Warnung; fehlgeschlagene Geometrieabrufe
haben fuenf Sekunden Pause.

Der Tracker hatte rohe Aviation-Packs direkt an den Detektor weitergegeben.
Die Standalone schliesst zuvor FIRs und allgemeine Echo-Flaechen aus und fuehrt
CTR-Duplikate mitsamt Frequenzen zusammen. Diese unveraenderten Regeln,
AGL-Heuristiken und der benannte Flugplatz-Frequenzfallback sind jetzt gemeinsam
in navigation-warning-core.js verankert. Der Tracker wendet sie auf seinen
Flugbahnausschnitt an; die Standalone weiterhin auf ihre Routenschnittmenge.
Die bestehende Luftraum-/Terrainentscheidung selbst bleibt gemeinsam.

TAWS bekam bisher eine EMA pro eingehendem SimConnect-Paket mit roher Vertikalrate.
Jetzt entsprechen Ein-Sekunden-Abstand und aus Hoehenaenderung berechnete Rate
der Standalone. Bodentelemetrie waermt Daten vor, loest aber keine Terrain- oder
Luftraumansage aus. Schwellen/Cooldowns bleiben gleich. NAV_TERRAIN_EVIDENCE
protokolliert beim Ausloesen Hoehe, AGL, Geschwindigkeit, prognostizierte Rate,
Terrain und verbleibenden Abstand. Die vier Meldungen im gelieferten Log lassen
sich mangels vollstaendiger Positions-/Vorhersagewerte nicht einzeln als
Fehlalarm beweisen; das bleibt Gegenstand des naechsten Flugtests.

Bordbuch-Erinnerungen werden erst nach erkanntem Abheben angeboten, in App und
EFB mit derselben Projektion. Ein Landezeit-Banner darf wie Standalone auch bei
zuvor ausgelassener Startzeit schreiben. Vorher scheiterte das mit
manifest_boardbook_field_not_current. Auf dem Tracker werden vorhandene
Flugereignisse, Inventar und Compliance weiter geprueft. Der Banner verschwindet
beim Eintragen erst nach Erfolg. Explizites Oeffnen des Verlademanagers wird
jetzt ebenso wie Schliessen als Praesentationszustand synchronisiert; lokale
Fenster oeffnen weiterhin sofort.

pax-audio-style.js enthaelt die bestehende Standalone-Intercom-Kette unveraendert.
PC- und App-Ausgabe verwenden fuer Pax-Voice clear/intercom/intercom_noise aus
den zentralen Audioeinstellungen. Alte App-Einstellungen werden einmalig
uebernommen; Cues und Warnclips erhalten keinen zusaetzlichen Pax-Filter.
Die Desktop-Player-Kopie und Cloud-Audiospeicherung kennen das zusaetzliche Feld.

Im Test wurde Farewell um 05:30:04 UTC vorgeladen und war um 05:30:29 bereit,
wurde aber vor der Ausgabe erneut generiert. Autoritativer Touchdown-Kontext
hat jetzt Vorrang vor einem spaeter eingesandten App-Rezept. Ankunftswetter
bleibt zusammen mit Flugfakten eingefroren; Cargo-Ergebnis wird vor Ausgabe
weiter aktuell geprueft. Unveraenderte Rezepte verwenden die Vorbereitung,
veraenderte Erfolgskriterien verwerfen sie weiterhin.

Validierung: 219 gezielte Node-Tests, Ground-Flow-, Farewell-Differential-,
Tracker-Interface- und AWM-Queue-Selbsttests bestanden. Echte EFB-Hostassets in
Electron bei 900 px und 440 px visuell geprueft: Frequenzbanner sichtbar,
Polygon-Puls und schmale Darstellung korrekt (externe Kartenabrufe im Test
gesperrt). Windows-Testbuild erfolgreich; kein neuer Release und kein
Produktiv-Worker-Deployment. Reale MSFS-/Coherent-/iPhone-Audio- und TAWS-Pruefung
steht aus. Telemetrie-Takt und Cargo-Buendelung bleiben unveraendert.

Neue Clients erkennen die Zusatzfelder audioStyle, hasGeometry und cargoWindowOpenId
vor automatischer Migration bzw. Zusatzabfragen; aeltere Tracker bekommen dadurch
keine wiederholten nicht unterstuetzten Anfragen.

### Offene Kartentisch-Paritaet nach Screenshotvergleich (10.09.2026)

Erneute reine Code-/Screenshotpruefung: Die vorausgehenden Warnungs- und
Missionskorrekturen bedeuten keine vollstaendige EFB-/Standalone-UI-Paritaet.
Die folgenden Punkte sind noch offen und wurden in dieser Pruefung nicht als
behoben abgenommen:

- Toolbar: configureOriginalChrome baut eigene Menues, Bezeichnungen und
  Aktionen; Host-CSS erzwingt nowrap und kleinere Buttons. Beim Einklappen
  bleibt die Header-Mindesthoehe von 66 px. renderProgress setzt nicht die
  Standalone-Klasse route-progress-visible, die den Handle unter die
  Navigationszeile verschiebt.
- Flugzeug: EFB verwendet aircraft-marker.svg in 40 x 40 mit Drehpunkt 50/50;
  Standalone das live-plane-SVG mit einstellbarer Groesse/Farbe und Drehpunkt
  50/37. Beide Renderer und Anker sind derzeit unterschiedlich.
- Hoehenprofil: eigener EFB-Canvasrenderer fuer den empfangenen Routenplan;
  HDG-Umschalter und Einstellungen werden im Host-CSS ausgeblendet. Die
  Standalone-HDG/Flugbahn-Darstellung ist damit nicht durch blosses Sichtbarmachen
  des Buttons verfuegbar. Profilrenderer, Steuerung und erforderliche lokale
  Tracker-Profildaten muessen zusammen adaptiert werden.
- Kompass: eigener SVG-/CDI-Aufbau statt buildCompassSvg/buildCompassFixed.
  HDG-Ziffernanzeige und Wegpunkt-Bug fehlen. Die CDI-Ablenkung verwendet eine
  andere Formel/Richtung; diese muss mit identischen Navigationseingaben gegen
  Standalone geprueft werden. Das S wird im aktuellen EFB-Code erzeugt;
  sein Fehlen im Screenshot ist daher nicht durch einen fehlenden Textwert
  erklaert und braucht den Rendervergleich im Coherent-Host.
- Kruemelweg: im EFB fehlt die Entsprechung zu _recordLiveTrailPoint und
  _renderLiveTrailIfNeeded (Standalone: Aufnahme ab mehr als 20 m Abstand,
  begrenzte Punktliste und inkrementelles Zeichnen). Bestehende Telemetrie
  reicht fuer den Verlauf ab Oeffnen; Wiederherstellung nach Reload braucht
  einen begrenzten Verlauf vom Tracker, nicht staendig den vollen Fluglog.
- Der schmale Screenshot-Banner ist missionStartBanner, nicht der zuvor
  korrigierte Frequenzbanner. Gemeinsames Markup/CSS existiert bereits;
  width:min(...) hat keinen einfachen Breitenfallback. Container, CSS-Auswertung
  und tatsaechliche Breite muessen im Coherent-Rendervergleich geprueft werden.
- Kacheln: direkte OpenTopo-Quelle, backup.opentopomap.org und Trackerproxy
  sind bereits vorhanden. EFB benutzt eine separate generische Retry-Implementierung
  (5 s primaer, danach 7 s), Standalone createResilientOpenTopoLayer (4,5/7 s).
  Der Screenshot allein beweist keinen fehlenden Backup. Fehler/Timeout,
  Zoomwechsel und Entfernen noch ladender Kacheln brauchen gezielte Tests.

Empfohlene Umsetzung: vorhandene Standalone-Bausteine fuer Toolbar, Marker,
Kompass und Trail gemeinsam verwenden; Profil als eigenen zusammenhaengenden
Paritaetsschritt inklusive HDG-Daten behandeln. Gegen identische Flugpunkte,
Heading/Track-Abweichungen, Fensterbreiten sowie Ein-/Ausklappen vergleichen.
Die in Arbeit befindlichen Missions-/Audiofixes und der 500-ms-Relay-Takt
bleiben davon unberuehrt. Kein Rollout in dieser Pruefung.


### Kartentisch-Paritaet: erstes Umsetzungspaket (10.09.2026)

Der User hat eine schrittweise, sorgfaeltige Umsetzung freigegeben. Dieses
Paket schliesst die direkt pruefbaren Karten-/Chrome-Abweichungen; das
HDG-Profil bleibt ein eigener zusammenhaengender Folgeschritt.

- Toolbar darf wie in der Standalone umbrechen. Kein erzwungenes horizontales
  Scrollen, keine feste 66-px-Mindesthoehe. Einklappen aktualisiert Pfeil,
  aria-expanded und die route-progress-visible-Klasse. Der Handle folgt der
  tatsaechlich gemessenen Navigationszeile, auch nach einem Fensterwechsel.
  Die native EFB-UTC/Statuszeile behaelt 28 px Platz ausserhalb der klappbaren
  Toolbar, nur im eingebetteten Host. Dadurch wird sie beim Einklappen nicht
  von Bedienelementen ueberdeckt.
- Kompass und Flugzeug verwenden map-live-presentation.js gemeinsam mit der
  Standalone. Originales Flugzeug-SVG, 50/37-Anker, konfigurierbare CSS-Farbe/
  Groesse; Kurswechsel veraendern nur den SVG-Transform. Der gemeinsame Kompass
  enthaelt Kardinalrichtungen, HDG-Anzeige, Wegpunkt-Bug und dieselbe CDI-
  Richtung/Skalierung; 359/0-Wechsel drehen ueber den kurzen Weg.
  MS33558.ttf wird jetzt lokal aus dem Tracker ausgeliefert und mitgepackt.
- EFB-Kruemelweg: Aufnahme bei mehr als 20 m Abstand, inkrementelles Zeichnen,
  identische blaue Strichelung; ueber 12000 Punkte auf 8000 kuerzen. Kein
  zusaetzlicher Telemetrieabruf. Verlauf beginnt beim Oeffnen des Hosts;
  Wiederherstellung nach Reload ist damit noch nicht umgesetzt.
- Gemeinsamer Missionsbanner verwendet width:calc(...) plus max-width statt
  CSS min(...). Das beseitigt die intrinsische Schmalspalte bei Renderern ohne
  min()-Unterstuetzung und behaelt die bestehende Standalone-Breite bei.
- Der bereits vorhandene Karten-Fallback bleibt direct -> backup -> proxy.
  Primaertimeout entspricht jetzt Standalone (4500 ms). URLs inklusive
  nativer Zoomstufe werden beim Erzeugen der Kachel fixiert. tileunload bricht
  deren Timer und Bildabruf ab; spaete Events starten keine Ersatzabrufe mehr.
  Keine Aussage, dass dadurch Ausfaelle externer Kartenanbieter verschwinden.

Validierung: 35 gezielte Node-Tests sowie Tracker-Interface-Selbsttest PASS.
Der reproduzierbare tools/efb-kartentisch-ui-selftest.cjs verwendet echte
Hostassets in Electron, blockiert externe Abrufe und prueft Marker-DOM,
Kompass/CDI, Trail, Bannerbreite, Einklappen, Portrait/Landscape-Wechsel und
native Header-Reserve im iframe. Screenshots visuell kontrolliert. Windows-
Testbuild mit dem neuen Baustein und der lokalen Schrift erfolgreich. Echter
MSFS-/Coherent-Test steht aus. Kein Release/Produktiv-Rollout dieses Pakets.

Noch offen: vollstaendige Menue-/Aktionsparitaet (die vorhandenen EFB-Menues
haben weiterhin ihren bisherigen Funktionsumfang), Profilrenderer samt HDG-
Daten/Steuerung und lokale Verlaufwiederherstellung. Die eckigen App-Buttons
und runden EFB-Buttons im Vergleich kommen ausserdem von unterschiedlichen
Themes: EFB erzwingt gemaess bisherigem Beschluss Modern/Classic. Die bestehende
Theme-Entscheidung wurde nicht stillschweigend durch einen CSS-Nachbau ersetzt.

### Kartentisch-Paritaet: gemeinsames Standalone-Profil (10.09.2026)

Der Folgeschritt ersetzt den vereinfachten EFB-Canvas durch das originale
`profile.js`. Keine zweite Implementierung von Flugbahn, Wetterdarstellung,
HDG-Abtastung oder Bedienelementen. `map-profile-controls.js` enthaelt die aus
App/HTML verschobenen Menue-, Render-Batch- und schmalen Bildschirmregeln;
`sync.js` und EFB nutzen zudem denselben richtungssensitiven Positionsabgleich.

- RTE/HDG, automatische HDG-Aktivierung ab der bestehenden GS-Schwelle,
  81 Terrainpunkte, zwei Minuten Rueckblick und 15 Minuten Vorschau bleiben
  Standalone-Code. Gleiches gilt fuer Zoom, ALT/V/S, Wetter-/Luftraum-/Traffic-
  Layer und Profil-Resize. Der Profiltransport erzeugt keine Warnungen oder
  Missionsaktionen; die zentrale Tracker-Warnlogik bleibt zustaendig.
- `tracker-efb-profile-bridge.js` liefert Telemetrie und lokale Daten.
  `tracker-profile-data.js` verwendet den bestehenden Tracker-Navigationscache
  fuer Terrain, Luftraumdaten, Airports, Orte, Hindernisse und Wetter. Originale
  METAR-/Hindernis-Fallbacks behalten ihre Antworten/Statuscodes. Gzip wird im
  Tracker genau einmal dekodiert. Keine Profil-Massendaten ueber das Relay.
- Zwei Terrain-Worker pro Profilbatch, einschliesslich Fehlerfall vollstaendig
  geleert; abgebrochene wartende Requests starten keine weiteren Samples.
  Das laesst im gemeinsamen Download-Limit Kapazitaet fuer Warnabfragen.
  XHR mit begrenzter Laufzeit erlaubt Abbruch auch ohne natives AbortController
  im EFB. Fehlende Hoehen werden nicht als gueltige Nullhoehe zurueckgegeben.
- Babel uebersetzt Originaldateien beim Asset-Sync fuer die aeltere EFB-Engine.
  Generierte Dateien unter efb-web-assets werden nicht manuell gepflegt.
  Dadurch bleiben Quelllogik und Rendering gemeinsam. Build-Abhaengigkeiten
  sind exakt versioniert; keine Babel-Laufzeit oder Compiler im Trackerbetrieb.
- Der Host entfernt Original-Symbole nicht mehr pauschal aus dem DOM. Wenn der
  App-Profilsnapshot vorliegt, werden Theme und TAS/ALT/Steig-/Sinkwerte als
  Ausgangswerte uebernommen. Lokale Aenderungen an ALT/V/S bleiben lokal.
  Das ersetzt fuer diesen Abgleich den frueher erzwungenen Classic-Look.
- EFB-Traffic bleibt zwischen lokalen Snapshot-Abfragen erhalten; derselbe
  Standalone-Filter entfernt Ownship und weit entfernten hoehenfremden Traffic.
  Keine hoehere SimConnect-Traffic-Abfragerate und kein zusaetzlicher Relayabruf.

Pruefung: Node-Tests fuer Datenvalidierung, Gzip, Cache-/Fehler-/Abbruchpfade,
Parallelitaetsgrenze, HTTP-Origin/Statuscodes, Projektion und Coherent-Syntax.
`tools/efb-profile-ui-selftest.cjs` prueft mit lokalen Fixtures das echte Profil,
Wetter, HDG/RTE, Flugleistungswerte, Original-Zahnrad, Theme, Menueposition,
Portrait/Landscape, Verbindungsausfall und Wiederverbindung. Derselbe Test
laeuft mit GA_UI_USE_STANDALONE_PROFILE=1 direkt auf den Originalquellen.
Beide Varianten PASS; externe Requests werden im Test blockiert. Das ersetzt
keinen echten MSFS-/Coherent-Sichttest. Noch nicht produktiv ausgerollt.

Weiterhin separat offen: vollstaendige Anzeige-/Mission-/Werkzeuge-Menues und
Aktionsparitaet ausserhalb der Profilsteuerung, lokale Wiederherstellung des
Kruemelwegs und der schon separat bearbeitete schwarze EFB-Bildschirm beim
Kamerawechsel. Keine Behauptung vollstaendiger EFB-/Standalone-Gleichheit.

### 2026-09-10: Original-Anzeigemenue, Leg-Beschriftung und Sitzungs-Kruemelweg

Weiterer lokaler Paritaetsschritt, noch nicht ausgerollt:

- `map-display-controls.js` enthaelt die Original-Defaults, gespeicherten
  Anzeigezustaende, Menue-/Untermenuebedienung, Flugzeugsymbol-Einstellungen
  und Leg-Beschriftung aus map.js/sync.js/index.html. Die Standalone laedt
  dieselbe Quelldatei; der Asset-Sync uebersetzt sie fuer Coherent.
- EFB-eigene Anzeige-/Mission-/Werkzeuge-Dropdowns wurden entfernt.
  Missions-/Verladeaktionen bleiben an den vorhandenen direkten Buttons,
  Mission/Checklisten im bestehenden Drawer und Werkzeuge in der Werkzeugleiste.
  Kein zweiter Missionscontroller wird geladen.
- Telemetrie, Aktuell, Wegpunkt-Info, Route-Leiste, Kompass, Low-FPS-Darstellung
  und Flugzeugfarbe/-groesse verwenden Original-Schalter und Original-Keys.
  Alte versteckte EFB-Infofenster werden einmalig in diese Keys migriert.
- Die Direktlinie gilt nun auch fuer den automatisch aktiven Wegpunkt;
  Farbe, Breite und Interaktivitaet stammen aus derselben Darstellungskonstante
  wie in der Standalone. Die alte abweichende cyanfarbene Vorschau entfiel.
- Leg-Kurs/Distanz/Dauer, Schriftgroesse und Kartenausrichtung verwenden den
  unveraenderten Originalrenderer. Die Dauer nutzt das uebernommene TAS-Setting.
- Live-Spur: gemeinsames Sampling >20 m und identisches Trimmen 12000 -> 8000.
  Die Standalone behaelt ihre bisherige Fenster-Lebensdauer. Das EFB kann die
  Spur innerhalb derselben Browsersitzung nach einem Reload wiederherstellen.
  SessionStorage wird maximal alle zwei Sekunden und bei pagehide geschrieben.
  Eine nur lokal uebertragene HTTP-Server-Sitzungskennung verhindert die
  Uebernahme aus einem frueheren Trackerlauf. Explizit fehlende Telemetrie
  loescht die Spur; ein fehlgeschlagener Netzwerkabruf allein tut das nicht.
  Keine Missionsdatei und kein Relay-/Cloudflare-Intervall geaendert.

Bewusst weiterhin offen: Snapping/Einzelklick, Karten-Wetter samt VFR-Index,
Terrain-Avoid-Kartenlayer, Karten-Traffic und Autozoom. Ihre Originalcontrols
sind im EFB deaktiviert, sichtbar abgeschwaecht und mit Hinweis versehen,
solange die zugehoerigen Originalrenderer/-aktionen fehlen. Keine Ersatzlogik
und keine nur optisch wirksamen Schalter. Profil-Wetter/-Traffic ist davon
getrennt und bereits implementiert. Auch die Zeichnen-/Messenlogik und weitere
Kartenaktionen benoetigen noch einen vollstaendigen Standalone-Abgleich.

Validierung: `tools/efb-display-ui-selftest.cjs` vergleicht Original- und
kompilierte Menuequellen in der echten EFB-Seite mit lokalen Fixtures:
Sichtbarkeit auch nach neuen Snapshots/Reload, Direktlinie, Leg-Dauer,
Flugzeugsymbol, Menue-Scrolling/Position bei Portrait/Landscape,
Sitzungswechsel und Spurwiederherstellung. Externe Requests sind blockiert.
Node-Tests decken Sampling/Trimmen, ungueltige gespeicherte Punkte und die
lokale HTTP-Sitzungskennung ab. Ein echter MSFS-/Coherent-Sichttest steht aus.

Zusaetzlich PASS: vollstaendiger Standalone-Seitenstart ohne JavaScript-Fehler
(`tools/standalone-display-ui-selftest.cjs`), inklusive originaler
applyMapHintEffects, Leg-Dauer und Flugzeugsymbol. 25 Presentation/Web-Tests,
18 lokale HTTP-Tests, Profil-UI und Missions-Interface-Regression PASS.
Windows-Testbuild `/tmp/GA-Tracker-display-parity-check.exe` erstellt;
keine Veroeffentlichung und kein behaupteter MSFS-Laufzeittest.

### 2026-09-10: Gemeinsamer Autozoom und Terrain-Avoid-Kartenlayer

Prioritaet nach User-Abgleich: Autozoom und Terrain Avoid zuerst. Karten-Wetter
und Karten-Traffic bleiben vorerst ausgeklammert; naechster relevanter
Wetter-Schritt ist das Regen-Overlay, nicht ein kompletter Wetter-Nachbau.

- `map-autozoom.js` enthaelt die Standalone-Implementierung aus sync.js:
  Flugphase, AGL/GS, TAS/CRZ, Vorausschau, Ziel-/POI-Fokus, sichtbarer Ausschnitt,
  weiche Zoomschritte, manuelle Zoom-Haltefunktion und Follow-Unterbrechung beim
  Verschieben. Auch die Low-FPS-Pan-Gates sind gemeinsam. EFB verbindet seine
  lokalen Flug-/Routendaten und gespeicherten Follow-Zustand mit diesem Code.
  Zielauswahl veraendert keine Tracker-Missions- oder Navigationsautoritaet.
- `map-terrain-avoid.js` enthaelt den originalen Terrarium-Canvas-Layer aus
  map.js: Farb-/Clearance-Schwellen, maximal Quellzoom 13, Elternkacheln bei
  hoeherem Zoom, RAM-/Rendercache, Hoehen- und Zeitgates sowie Pause nach der
  Landung/Wiederaufnahme in der Luft und geplante CRZ als Fallback.
  Eine kleine gemeinsame Fehlerkorrektur laedt bei fehlendem Speicherwert
  die vorgesehenen 500/1000 ft statt Number(null)=0. Gespeicherte 0 bleibt 0.
- EFB-Steuerung und Untermenues werden jetzt freigeschaltet. Follow zeigt das
  gleiche Ziel-/Pin-Symbol und nutzt dieselbe Bedienung wie die Standalone.
- `GET /api/v1/terrain-tiles/{z}/{x}/{y}.png` liefert nur gueltige Terrarium-
  Koordinaten bis Zoom 13. Die Quelle ist fest, kein freier URL-Proxy. Kacheln
  nutzen denselben bestehenden Tracker-Navigationscache (180 Tage TTL) wie
  Hoehenabfragen. Gleichzeitige Raw-/Hoehenzugriffe teilen Downloads; die
  Hoehendekodierung haengt nicht mehr von einem Validator-Seiteneffekt ab.
  Das EFB greift lokal zu; kein neuer Relay-/Cloudflare-Datenpfad, keine
  Aenderung der Telemetrie- oder Missionsintervalle.
- Standalone und EFB laden dieselben Quellmodule; der vorhandene Asset-Sync
  erstellt die Chrome-49-kompatiblen Fassungen. Keine separate Autozoom- oder
  Terrain-Entscheidungslogik im EFB-Host.

Pruefung: `tools/efb-autozoom-terrain-ui-selftest.cjs` vergleicht Original- und
kompilierte Quellen auf echter Leaflet-Karte und Canvas: Boden/Abflug/Reise/
Anflug, manuelle Zoomwahl, Follow/Drag, Wegpunktauswahl, Terrain-Pixel,
Quell-Overzoom, paralleler Kachelabruf, Landung/Abheben, Verbindungsausfall,
CRZ-Fallback und gespeicherte Einstellungen nach Reload. HTTP-Tests pruefen
PNG-Antwort, Koordinatengrenzen und Fehlerpfad; Cache-Test prueft gleichzeitig
Overlay plus Hoehenabfrage sowie Wiederverwendung nach Neustart ohne Netz.
Externe Requests sind in Browser-Tests blockiert. Echte MSFS-/Coherent-
Darstellung und Laufzeit muessen im naechsten Sim-Test bestaetigt werden.
Noch nicht ausgerollt.

Validierung dieses Schritts abgeschlossen: 34 Node-Tests plus 19 lokale
HTTP-Tests PASS; Autozoom/Terrain-Browsertest (Original/kompiliert), komplette
Standalone-Anzeigeseite, EFB-Profil und Missions-Interface-Regression PASS.
Unveroeffentlichter Windows-Testbuild:
`/tmp/GA-Tracker-autozoom-terrain-check.exe` (pkg node18-win-x64).

### 2026-09-10: Gemeinsame Seitenmenüs, Regenradar und E6B-Schrift

Lokaler Folgeschritt, noch nicht veröffentlicht. Wetter-/Traffic-Ausbau bleibt
wie vereinbart zurückgestellt; das Niederschlagsradar ist ausdrücklich enthalten.

- Das EFB lädt jetzt `checklists.js` aus derselben Quelle wie die App (für
  Coherent kompiliert). Original-Startseite, Standardlisten, Kapitel, Häkchen,
  Editor und Unteransichten ersetzen den reduzierten EFB-Nachbau. Die
  Checklistenbreite kommt wieder aus `styles.css`. Tracker-Customlisten werden
  über einen kleinen Datenadapter ergänzt; ihre Daten werden nicht durch
  EFB-Cloud-Polling überschrieben. Lokale Häkchen nutzen den Originalspeicher.
- Mission Control verwendet weiterhin den gemeinsamen Renderer. Cargo-Aktionen
  gehen über die vorhandene Tracker-Intent-Queue; die UI bestätigt keinen
  Manifestwechsel vor dem ACK. Bordbuchfelder werden mit dem gemeinsamen
  Manifest-Core und den aktuellen allowedActions geprüft. Die Missionssemantik
  bleibt unverändert.
- `airport-radio.js` und `map-tool-focus.js` enthalten die unveränderte
  Frequenzzuordnung bzw. Karten-/Profilmarkierung aus app.js. Radio, Nearest und
  Warnungslisten beziehen öffentliche Daten über den lokalen, gecachten
  Profiltransport. Dieser erlaubt zusätzlich nur die festen Airports-/Navaids-
  und RainViewer-Metadaten-Endpunkte; keine beliebigen URLs.
  Der Kartenkontext überträgt Start-/Ziel-ICAO ausdrücklich, damit ausgeschriebene
  Flugplatznamen nicht irrtümlich als Kennung für Frequenzabfragen dienen.
- `map-layer-controls.js` ist die gemeinsame Klick-/Schließlogik und Radarquelle.
  Die zuletzt verfügbare RainViewer-Aufnahme nutzt dieselben URL-Parameter,
  Deckkraft und Zoomgrenze sowie `ga_radar_active`. Das geöffnete Layer-Menü
  wechselt in den Kartenrahmen, damit der gefilterte Kartencontainer es nicht
  unter Kompass/Overlays einsperrt. Beim Schließen kehrt es in Leaflet zurück.
  Gemeinsame CSS-Regeln neutralisieren Formular-Textfarben und 48px-Mindesthöhen
  der Radio-/Checkboxen; die Liste scrollt innerhalb des verfügbaren Rahmens.
- EFB-Textnormalisierung erhält jetzt Unicode (NFC), statt Symbole und Einheiten
  pauschal in ASCII umzuwandeln. Weitere fest kodierte ae/oe/ue-UI-Texte wurden
  korrigiert. Das ersetzt keine fehlenden Schriftdateien oder Engine-Glyphen.
- `e6b/e6b-svg-compat.js` wird von beiden E6B-Oberflächen benutzt: Ohne SVG
  `paint-order` entsteht der helle Schriftrand durch eine separate Textkopie
  hinter der unveränderten dunklen Schrift. Moderne Browser behalten ihren
  bisherigen Renderpfad. Der Coherent-Eingabe-/Layoutadapter bleibt erhalten.

Nachweise: 31 Node-Tests für EFB-Assets/Protokollsyntax, Kartenkontext und lokalen Datentransport;
`tools/efb-sidebar-layer-ui-selftest.cjs` vergleicht Original und Kompilat mit
Fixture-Daten (Home, Häkchen/Persistenz, Tracker-Listen/Umlaute, Radio/Nearest,
Cargo-ACK-Sperre, Bordbuchfelder, Kartenfokus, Radar, Rotation/Schließen und
simuliertes fehlendes paint-order). Screenshots unter
`/tmp/ga-sidebar-layer-check`. Standalone-Einstiegsseite wird separat gestartet.
Windows-Testbuild: `/tmp/GA-Tracker-sidebar-radar-check.exe`; kein Upload.

Weiterhin keine vollständige Funktionsparität behaupten: Direct To aus dem
Seitenmenü und der separate manuelle Sim-Gewichtsabruf besitzen im EFB noch
keinen passenden Command-Adapter und sind dort deaktiviert. Ergänzende
Flugplatzdetails (Runway-/Wiki-/AIP-Datenpfad und Browsernavigation),
Community-Veröffentlichung aus dem EFB sowie sämtliche verbleibenden
Unterdialoge brauchen weitere Prüfung. Wetteranalyse/Traffic bleiben bewusst
zurückgestellt. E6B-Schrift, Font-Fallbacks und Interaktion sind im realen
MSFS-Coherent-Feldtest noch zu bestätigen.

### 2026-09-10: Direct To, Sim-Gewichte und Platzdetails im gemeinsamen Seitenmenü

Lokaler Folgeschritt; noch kein Release/Upload.

- `map-direct-to-core.js` extrahiert Startauswahl und Zwei-Punkt-Route aus dem
  App-Direct-To. App und Tracker verwenden diese Funktionen. Im EFB sendet
  derselbe Nearest-/Platz-Button einen authentifizierten `airport_direct_to`-
  Toolauftrag. Der Tracker prüft Koordinaten, frische Live-Position und
  Navigationsrevision. Aktive Missionen werden nicht überschrieben: der
  bestehende explizite Abort bleibt vorgeschaltet, danach wird neu gewählt.
- Die private Route liegt als `navigation-route-v1.json` im Trackerordner.
  Sie ist **kein** Mission-Run, erzeugt kein Manifest und keine Szeneneffekte.
  EFB und Toolbar lesen dieselbe Kartenprojektion; Wegpunktwarnungen nutzen
  diese Route ebenfalls. Sobald eine echte Mission projiziert wird, wird die
  vorherige private Route entfernt, damit sie nach Missionsende nicht wieder
  erscheint. Das repliziert noch keine private Tracker-Route in die entfernte
  Browser-App; deren bestehender eigener Direct-To-Ablauf bleibt erhalten.
- `read_payload` ruft den vorhandenen `refreshPayloadSnapshot(12)`-/SimConnect-
  Leseweg auf. Gleichzeitige Abrufe teilen den laufenden Read, auch wenn eine
  Mission aktiv ist. EFB aktualisiert `aircraftPayloadStatus` erst aus der
  Antwort; Manifest/Payload-Set werden nicht angerührt. Nach SimConnect-
  Reconnect wird der Leseadapter neu gebunden.
- `airport-details.js` enthält die ursprüngliche OpenAIP-Pistenformatierung,
  Auswahl, OSM-Fallbacks und Cachezeiten aus App/map. Der EFB-Adapter liefert
  rohe Airports aus dem bestehenden lokal gecachten Aviation-Datenpfad.
  `airport-aip.js` enthält die originale Länderauswahl/URL-Erzeugung. AIP-Klicks
  öffnen über den Tracker den PC-Standardbrowser; der Server akzeptiert nur
  ICAO/Land und baut die feste AIP-URL selbst.
- `/api/v1/cockpit/tools` nutzt die bestehenden Cockpit-Sitzungen,
  Origin-Prüfung, begrenzte Befehlsrate und Deduplizierung (auch für laufende
  Requests). Diese Tools sind ausdrücklich keine Mission-Intents.
- Die originale Seitenansicht besitzt keinen separaten Wiki-Abschnitt; hier
  wurde keiner erfunden. Allgemeine Wetteransichten bleiben zurückgestellt.
- Nebenbefund im gemeinsamen Code behoben: ein 80-ms-Resize-Timer der
  Platz-Minimap wird beim Entfernen der Karte abgeräumt. Schnelle Antworten
  und Ansichtswechsel greifen so nicht auf entfernte Leaflet-Panes zu.

Verifikation: Node-Tests für Tool-Service, HTTP-Sitzungsgrenzen, Projektion,
Datenadapter und Client; UI-Test in Original und Coherent-Kompilat für
Direct-To-Klick/ACK/Kartenübernahme, Gewichte/Stationen, Pisten und AIP sowie
bisherige Menüprüfungen. Standalone-Einstiegsseite und Missionsregressionen
separat geprüft. Windows-Testbuild unter `/tmp/GA-Tracker-cockpit-tools-check.exe`.
PC-Browseraufruf und echte SimConnect-Gewichte benötigen den Windows-/MSFS-Test.

### 2026-09-10: Gemeinsame Routenbearbeitung in App, EFB und Toolbar

Lokale Umsetzung, noch kein Rollout. `navigation.route.v1` kündigt den neuen
App-/Relay-Vertrag an; ältere Tracker und Web-geführte Missionen behalten den
bestehenden App-Pfad.

- `map-route-edit-core.js` extrahiert die Standalone-Auswahl des Routensegments
  (kleinster Umweg), die Snap-Gewichtung und die Änderung der Zwischenwegpunkte.
  EFB/Toolbar bieten den gleichen 44-px-Klickbereich auf der Routenlinie,
  verschiebbare Zwischenpunkte und den Löschen-Button im Popup. Start und Ziel
  bleiben fest. Missions-POIs werden nicht als normale Wegpunkte umgedeutet.
- `map-navigation-client.js` hält bestätigte Route und ausstehende Kartenänderungen
  auseinander. Eigene Eingaben werden sofort dargestellt und der Reihe nach
  bestätigt. Nach einem Konflikt werden nachfolgende, nun möglicherweise falsch
  indizierte Änderungen verworfen; es gibt kein blindes Replay nach Timeout.
- Lokales HTTP verwendet die vorhandenen Cockpit-Sitzungen. Die entfernte App
  verwendet denselben Tool-Service über den vorhandenen Pilot-/PIN-Relay-Pfad
  (`navigation_route_request`/`navigation_route_ack`). Doppelte Befehls-IDs werden
  dedupliziert. Bestätigte Änderungen werden sofort verteilt; die normale
  Statusmeldung enthält zur Wiederaufnahme lediglich Routen-ID und Revision.
  Der 500-ms-Telemetrieintervall wird nicht verändert.
- Private Direct-To-Routen und deren Zwischenpunkte werden im Tracker gespeichert.
  Ein expliziter Bearbeitungsklick kann eine vorhandene private App-Route in einen
  noch leeren Tracker übernehmen. Eine bestehende Tracker-Route wird beim
  Verbinden nicht ungefragt von einem alten App-Speicherstand überschrieben.
- Bei Tracker-geführten APT-Runs liegt die bearbeitete Navigationsroute mit eigener
  Revision am bestehenden Run. Sie verändert weder Cargo/Signaturen noch
  Ausführungszustand, MissionTruth, Start/Ziel oder Szenenanker. Alle Karten- und
  Warnungsprojektionen verwenden diese Route. Route Reset stellt die ursprüngliche
  Missionsroute wieder her. Eine laufende Behördenkontrolle blockiert Änderungen
  mit derselben Bedingung wie die App. Andere Missionsrezepte bleiben gesperrt.
- Ein veraltetes vorberechnetes Routenprofil wird nach einem Umweg nicht auf die
  neue Strecke gestreckt; die Ansichten berechnen es über den vorhandenen
  Terrain-/Profildatenweg neu.

Grenzen: freies Versetzen von Missionszielen/POIs und weitere Missionsrezepte
gehören nicht zu dieser APT-Stufe. Der vorhandene EFB-Schalter für Snapping bleibt
bis zur Übernahme seiner vollständigen Nav-/Reporting-Point-Datenansicht gesperrt;
freies Setzen und Verschieben ist angeschlossen. Windows-/MSFS-Coherent muss
Touch/Drag und den echten Relay-/Sim-Betrieb noch im Feld bestätigen.

Nachweise dieser Stufe: Core-/Authority-Tests für Reihenfolge, fremde Revision,
Timeout, Endpunkt-/Missionspunkt-Schutz, Behördenkontrolle, Neustart,
Persistenzfehler, Relay-Deduplizierung und erhaltene Meldepunkt-Metadaten;
HTTP-Sitzungsprüfungen und Coherent-Syntaxprüfung. Der lokale Electron-Test
`tools/navigation-parity-ui-selftest.cjs` betreibt App, EFB und Toolbar mit einem
gemeinsamen Test-Service: EFB setzt, App verschiebt, Toolbar löscht; Änderungen
werden an die App gepusht. Auch App-Direct-To und das Zurückspringen eines
Markers bei Verbindungsverlust sind geprüft. Externe Karten-/Wetterabrufe sind
in diesem Test gesperrt. Standalone-Einstiegsseite, gemeinsame Seitenmenüs
(Original/Kompilat) und Missionsregressionen bestehen ebenfalls.
Windows-Testbuild: `/tmp/GA-Tracker-navigation-route-check.exe`, 52.770.919 Bytes,
PE-Dateikennung geprüft; kein Upload/Release.

### 2026-09-10 — Navpunkt-Fangfunktion und Cache-Aktualisierung (lokal)

EFB und Toolbar verwenden beim Ziehen von Zwischenwegpunkten jetzt den bereits
mit der App geteilten 25-Pixel-Snap-Algorithmus aus `map-route-edit-core.js`.
Die ursprünglichen Kandidaten-Builder (APT, NAVAID, RPP einschließlich
Frequenzen, Meldepunkt-ICAO, Airport-Fallback und dessen Padding) wurden
unverändert nach `map-navpoint-core.js` ausgelagert; auch `map.js` ruft diese
Builder auf. Start/Ziel und geschützte Missionspunkte bleiben geschützt.
Der vorhandene Snapping-Schalter ist freigeschaltet, mit den Originaltexten und
Farben. Routenlinien-Klicks setzen wie in der App zunächst einen freien Punkt;
das Einrasten erfolgt beim Ziehen. Flughäfen ab Zoom 6, Funkfeuer/RPP ab Zoom 8.

Die Kandidaten werden über den bestehenden lokalen `/api/v1/profile-data`
Transport vorgeladen. `tracker-navpoints.js` nutzt die vorhandene Hosted Aviation
DB, deren Region-Fallback, sowie die eigenen Flughäfen-, Navaid- und RPP-Dateien.
Große Kartenausschnitte verwenden statische Daten statt unbeschränkt viele Packs
anzufordern. Die vollständigen Daten bleiben im gemeinsamen, auf 4 GiB begrenzten
`navigation-cache` im Tracker-Datenordner. Über Loopback gehen nur Kandidaten;
über das App-Relay weiterhin nur die bearbeitete Route, keine Datenbank.

Cache-Lebenszyklus:
- Aviation-Versionskatalog: beim ersten Zugriff und danach stündlich revalidieren;
  neue Cycles erhalten eigene Pack-URLs/Cache-Keys, immutable Packs bleiben lange
  lokal erhalten.
- Veränderliche Flughäfen-/Navpunkt-/Hindernisquellen: stündliche TTL-Prüfung bei
  Nutzung; auch RAM-Caches laufen ab. Je nach Zugriff und RAM-Zwischenspeicher kann
  die Übernahme bis zum nächsten fälligen Abruf dauern; kein Hintergrund-Volldownload.
- Terrarium: tägliche Revalidierung bei Nutzung; decodierte RAM-Bilder werden
  spätestens nach einer Stunde erneut gegen den Disk-Cache gelesen.
- ETag/Last-Modified erlauben HTTP 304 ohne erneuten Nutzdatentransfer. Validatoren
  sind über den Body-Hash an die gespeicherte Datei gebunden. Ungültige Downloads
  ersetzen keine gültigen Daten. Bei Netzausfall bleibt der letzte gültige Stand
  verfügbar, mit bestehendem Retry-Cooldown. Alte Cache-Dateien ohne Metadaten
  bleiben lesbar und werden beim nächsten fälligen Abruf aktualisiert.

Geprüft: Datenstandwechsel inklusive neuen Pack-URLs, Offline-Neustart,
Fallback bei fehlgeschlagenen Collections, 304/Änderung/ungültige Antwort,
Einrasten und freies Ziehen in echten App-/EFB-/Toolbar-Electron-Fenstern sowie
Routen-Synchronisierung. Lokaler Stand, kein Release; MSFS-/Coherent-Feldtest offen.

### 2026-09-10 — Nachprüfung Routenbearbeitung/Navpunkt-Cache

Gezielte Korrekturen nach Code- und Standalone-Vergleich:
- Während eines offenen Routen-ACK werden ältere nachgereichte Snapshots nicht
  mehr über neuere gelegt. Auch ein fehlerhaftes/veraltetes ACK verwirft keine
  inzwischen empfangene bestätigte Route; unpassende Folgeänderungen entfallen.
- Der 44-px-Klickbereich zieht im EFB/Toolbar mit dem Wegpunkt mit, wie die
  sichtbare Linie und wie in `map.js`.
- Änderungen an Routen-ID, Name und geschützten Punktflags lösen auch ohne
  Koordinatenänderung den notwendigen Neuaufbau der Marker aus.
- Ein gemeinsamer Cache-Download prüft Größe und Validator für jeden Aufrufer.
  Die Validierung eines weniger strengen ersten Aufrufers ersetzt die eigene
  Prüfung nicht mehr. Aviation-Kataloge, Manifeste und Packs werden bereits vor
  dem Speichern auf Dokumentstruktur geprüft; HTTP-200-Fehlerdokumente verdrängen
  keinen gültigen lokalen Datenstand.

Regressionen für verspätete Revisionen, Konflikt-ACK, unterschiedliche
Cache-Validatoren/Größenlimits und defekten veröffentlichten Katalog ergänzt.
Der Drei-Fenster-Test prüft zusätzlich die während Drag mitlaufende Hitbox und
Punktschutz ohne Positionsänderung. Darstellungs- und Seitenmenütests vergleichen
Originalmodule mit ihrem Coherent-Kompilat einschließlich Portrait/Landscape,
Umlauten, Schaltern, Radar-Layer und E6B-Beschriftung.

Verbleibende bekannte Bedienabweichung: Start-/Zielflugplatz-Popups und der
Flughafen-Info-Knopf an Zwischenwegpunkten sind im EFB noch nicht vollständig wie
in `map.js` angeschlossen; Flughafen-Einzelklick bleibt deaktiviert. Der bestehende
EFB-Kartenkontext ersetzt diesen Standalone-Ablauf nicht vollständig. Wetter und
Traffic bleiben wie vereinbart außerhalb dieser Stufe. Kein Rollout und kein
Nachweis vollständiger MSFS-/Coherent-Parität durch die lokalen Browserprüfungen.

### Gemeinsame Flughafen- und Kartenkontext-Popups (10.09.2026, lokal)

Der oben dokumentierte Popup-Nachbau ist ersetzt. `map-airport-popup.js`,
`map-context-popup.js` und `airport-weather.js` enthalten die aus `map.js` und
`app.js` herausgezogenen Originalimplementierungen. App, EFB und Toolbar verwenden
sie gemeinsam; das EFB lädt das Coherent-Kompilat. Dazu gehören Start-/Zielmarker,
Flughafen-Info an Zwischenpunkten, Direct To, Pisten, Frequenzen, METAR-Windrose,
„Was ist hier?“, anklickbare Lufträume/Objekte, ihre Kartenmarkierungen und das
Höhenband mit eigener Live-Höhe. Die alten EFB-Kontext-Renderer und deren eigene
CSS-Regeln sind entfernt.

Die Host-Brücke liefert rohe Aviation-Geometrien und Höhen-/Frequenzangaben aus
`profile-data/aviation`, begrenzt auf einen lokalen Kartenausschnitt. Darstellung,
Trefferradius und Normalisierung bleiben im gemeinsamen Code. Terrain kommt aus
dem vorhandenen Terrarium-Cache, METAR über den vorhandenen lokalen Ressourcenweg.
Ein fehlgeschlagener Terrainabruf wird nicht mehr als 0 ft ausgegeben. Geschlossene
Kontextfenster verwerfen verspätete Antworten; Scrollen/Tippen im Popup löst keinen
neuen Longpress aus.

AIP-Links sind im EFB als „im PC-Browser öffnen“ gekennzeichnet und delegieren an
den vorhandenen authentifizierten `open_airport_aip`-Cockpit-Befehl. Der Tracker
baut den Link aus ICAO/Land und öffnet den Windows-Standardbrowser außerhalb von
MSFS. Keine beliebigen URLs oder Shell-Kommandos werden aus dem Popup angenommen.
Die App behält normale Browser-Links. Fehler erlauben erneuten Klick.

Prüfung: Original und Kompilat mit realen Leaflet-Popups und lokalen Fixtures;
Flughafen/Navaid/VRP, Luftraum-/Objektmarkierung, eigene Höhe, METAR, AIP-Weitergabe
und Fehler/Wiederholung, Portrait/Landscape, spätes ACK nach Schließen und
Routenmarker. Zusätzlich der vollständige App/EFB/Toolbar-Routentest. Wetter und
Traffic als eigenständige Kartenfunktionen bleiben zurückgestellt; das originale
METAR-Widget ist Teil der Flughafen-Popup-Parität. Der allgemeine Karten-Einzelklick
(Tooltip/Panel-Schalter) ist weiterhin ein separater offener Punkt. Kein Rollout;
MSFS/Coherent und der tatsächliche externe Windows-Browser müssen im Sim getestet
werden.

### Lokale Telemetrie und verbleibende Kartenbedienung (10.09.2026, lokal)

Der lokale EFB-/Toolbar-Snapshot folgt jetzt jedem verfügbaren SimConnect-Sample
(bestehende Abfrage alle drei Sim-Frames). Der Tracker veröffentlicht ihn vor der
500-ms-Schranke. Missionsverarbeitung, Warnungsberechnung und Cloudflare-Telemetrie
behalten ihren bisherigen Takt; die lokale Beschleunigung erzeugt keinen
zusätzlichen Cloudflare-Traffic. Ein HTTP-Aufruf mit `after=localRevision` wartet
auf eine neue Revision, höchstens 1,5 Sekunden. Pro Ansicht bleibt nur ein Abruf
offen; langsamere Ansichten erhalten den neuesten Stand ohne Frame-Warteschlange.
Ältere Tracker ohne Revision behalten begrenztes Polling. Verbindungsabbrüche
entfernen Flugzeug, Live-Anzeigen und eigene Höhe im Kartenkontext.

Die Struktur der Route wird weiterhin separat abgefragt. Die aktuelle Position,
Peilung und der Fortschritt werden mit `map-navigation-geometry.js` aus frischer
lokaler Telemetrie berechnet; Tracker und EFB verwenden dieselben Funktionen.
Fehlende Flugplatzhöhen bleiben unbekannt und werden, soweit vorhanden, aus der
Flugplatzdatenbank ergänzt. Direct To erhält vorhandene Höhen einschließlich
echter 0 ft.

`map-drawing.js` und `map-single-click.js` enthalten die extrahierten
Standalone-Implementierungen: Zeichenleiste, Freihand/Linien, gezielter Radierer,
Lineal mit verschiebbaren Endpunkten sowie Karten-Einzelklick mit Tooltip und
Flughafen-/Funkfeuer-/Meldepunkt-Panels. Das EFB stellt lokale Daten und den
SVG-Renderer bereit, verwendet aber keine eigene vereinfachte Bedienlogik mehr.
Der zuvor offene Einzelklick-Punkt ist damit angeschlossen. Der METAR-Link
„Manuell suchen“ verwendet im EFB ebenfalls den authentifizierten PC-Browser-Weg
mit validierter ICAO und festem URL-Muster; die App behält den normalen Link.

Prüfung: 53 gezielte Node-Tests erfolgreich, darunter wartender lokaler Abruf,
parallel erreichbare Endpoints, zusammengefasste Samples und Disconnect.
Original-/Coherent-Kompilat-Popuptest mit Zeichnen, gezieltem Löschen, Lineal,
Einzelklick-Modi, verspäteten Antworten und Höhen-Fallback erfolgreich.
Vollständiger App/EFB/Toolbar-Routentest erfolgreich. Windows-Test-EXE gebaut
(53.054.991 Bytes, PE-Signatur geprüft). Noch kein Rollout; tatsächliche Bildrate,
Touchbedienung in Coherent und Browseröffnung unter Windows bleiben Sim-Prüfungen.

### Wegpunktführung und Vorhersagelinien (10.09.2026, lokal)

Die vier anschließenden Review-Befunde sind behoben:

- Lokale Telemetrie fordert nur den dynamischen Profilframe an. Sie markiert
  nicht mehr bei jedem Sample den gesamten Profilhintergrund als veraltet.
- CDI-Querabweichung und Anflugkurs stammen aus der originalen Standalone-
  Wegpunktauswahl. Das zuvor spiegelverkehrte Querabweichungsvorzeichen entfällt.
- `map-navigation-geometry.js` enthält jetzt die aus `sync.js` extrahierte
  Auswahl des aktiven Legs, den bestehenden 0,5-NM-Wechsel und die manuelle
  Wegpunktwahl. App, Tracker und EFB verwenden diese Funktionen gemeinsam.
  Die Auswahl bleibt bestehen, wenn das Flugzeug nach dem Wechsel noch näher
  am vorherigen Segment liegt. Schnelle lokale Samples aktualisieren die
  Geometrie sofort; automatisches Weiterschalten behält den Standalone-Takt.
- Ein explizit leerer Routensnapshot entfernt Route, Fortschritt und magentafarbene
  Ziellinie. Profilzoom-/Höhendaten werden ebenfalls bereinigt. Verspätete
  Höhenantworten dürfen eine gelöschte oder inzwischen geänderte Route nicht
  wieder darstellen. Ein einzelner fehlgeschlagener Abruf löscht keine Route.

Die Kartenvorhersage fehlte im EFB bisher, obwohl Punkte für das Höhenband
vorhanden waren. `map-prediction.js` enthält nun die originalen 1-/2-/5-/10-Minuten-
Punkte und ihre Leaflet-Darstellung für beide Oberflächen: gleiche GS-/V/S-
Glättung, gestrichelte Linie, Zeitmarker und Terrain-/Luftraumfarben. Das
Höhenband verwendet dieselben Punkte im originalen `profile.js`, sowohl in RTE
als auch HDG. Terrainfarben bleiben während des nächsten Abrufs sichtbar;
nach Disconnect oder unter der ursprünglichen Geschwindigkeitsgrenze werden
Karten- und Profilvorhersage gemeinsam entfernt. Verspätete Antworten werden
verworfen. Die Darstellung erzeugt keine neuen Warnungen oder Audioaufträge.

Die magentafarbene Linie verwendet bereits den gemeinsamen Standalone-Stil.
Ihre Zielauswahl und die dazugehörigen Kurs-/Distanzanzeigen hängen jetzt an
derselben Wegpunktlogik und reagieren sofort auf manuelle Auswahl. Lokaler
Telemetrietakt und der unveränderte 500-ms-Cloudflare-Takt bleiben getrennt.

Prüfung: 43 gezielte Node-Tests erfolgreich. Electron-Vergleich mit Original-
und Coherent-kompilierten Modulen prüft echte Kartenlinien, Farbpriorität bei
fehlender Terrainhöhe, manuelle Zielwahl, Vorhersagemarker im RTE-/HDG-Canvas,
Routenlöschung und verspätete Antworten. Bei 20 Positionssamples werden keine
vollständigen Profil-Neuzeichnungen angefordert. Der bestehende Profil-/Layout-
Test und der vollständige App/EFB/Toolbar-Routentest bestehen ebenfalls.
Sichtvergleich der Original-/Kompilat-Screenshots durchgeführt; bestehende
Anzeige-/Kartentisch-Tests ebenfalls erfolgreich. Windows-Test-EXE gebaut
(53.081.536 Bytes, PE-Signatur geprüft). Kein Rollout; die Prüfung im
tatsächlichen MSFS/Coherent bleibt erforderlich.

### Abschlussprüfung und Releasekandidat v399 / Desktop 1.6.10 (10.09.2026)

Die Abschlussprüfung korrigiert zusätzlich eine stehenbleibende magentafarbene
Ziellinie bei Telemetrieabbruch sowie einen möglichen Drag-Abschluss nach bereits
gelöschter Route. Der gemeinsame Autozoom wurde erneut mit Original-/Kompilat-
Szenarien für Boden, Abflug, Reiseflug, Zielnähe, manuellen Zoom, Follow und
Terrain-Avoid verglichen. Ergebnis: gleiche Entscheidungen und Pixelwerte.

534 App-/Runtime-Regressionen, 28 EFB-Shell-Tests und 48 Desktop-Tests bestehen.
Die lokale Navigations-/Prediction-Prüfung bestätigt auch das Ausblenden von
Ziellinie und CDI bei Disconnect. Cache v1735, EFB-Assetrevision 39901 und Tracker
v399 bilden den Releasekandidaten. Desktop 1.6.10 enthält die gemeinsame
Pax-Filterkette für die PC-Ausgabe; die Cloud-Audiospeicherung übernimmt das
zusätzliche Klangfeld. Das EFB-Community-Paket bleibt unverändert. Die Prüfung
auf dem echten Windows-/MSFS-System ist weiterhin der anschließende Feldtest.

Rollout: Quellstand `d30b8df64` ist auf origin/main veröffentlicht. Die Releases
`v399` und `tracker-desktop-v1.6.10` sind veröffentlicht; beide EXE-Downloads
wurden vollständig heruntergeladen und gegen lokale Größe und SHA-256 geprüft.
Der Alpha-Runtime-Zeiger wird auf v399 gesetzt; Stable bleibt unverändert.
Der Desktop-Installer 1.6.10 steht zum manuellen Feldtest bereit. Der automatische
Desktop-Update-Zeiger bleibt bis zum Windows-Installations-/Start-/Update-Test
unverändert (Release-Workflow Abschnitt 3a).

Die Cloud-Audiospeicherung mit `audioStyle` wurde als Worker-Version
`27c2431f-bc08-4d7c-bf2c-e31b192b75fc` veröffentlicht. Das isolierte Ausgangsbundle
war bytegleich zum bisherigen Live-Worker; fremde Admin-Änderungen aus dem
Worktree sind nicht Teil dieses Deployments.

### EFB-Feldbefund: fehlende Glyphen und überhohe Audio-Checkboxen (10.09.2026)

Das Foto nach v399 zeigt fehlende Emoji-/Symbolglyphen und vertikal verzogene
Checkboxen. Die gemeinsame Classic-Formularregel setzt auch Checkboxen auf
mindestens 48px. `#mapVoiceMenu` begrenzt nun ausdrücklich alle Checkboxmaße
auf 14px und neutralisiert deren Formular-Padding/Schattierung; die volle
Label-Fläche bleibt klickbar. Diese Korrektur gilt in App und EFB gemeinsam.

Coherent besitzt keinen verlässlichen systemweiten Unicode-Fallback. Der
EFB-Host liefert deshalb fest versionierte, unveränderte Noto-Text-/Mono-/
Symbolfonts und OpenMoji 16.0.0 als COLRv0-TTF lokal aus der Tracker-EXE.
Quellen und Lizenzen liegen in `ga-tracker-client/efb-fonts`. Die vorhandenen
namentlichen App-/Instrumentenschriften bleiben zuerst im Stapel; nur der
EFB-Adapter ergänzt fehlende Zeichen vor dem generischen Last-Resort-Font.
Canvas-Schriftzuweisungen des gemeinsamen Höhenbands bekommen beim EFB-Build
denselben Fallback. Ein kleiner DOM-Adapter hält ZWJ-Emojis wie den Piloten in
einer gemeinsamen Schrift, auch bei dynamisch nachgeladenen Inhalten.
Text, Handler und Missionslogik ändern sich dadurch nicht.

23 Node-Tests bestehen, einschließlich lokaler Font-Endpunkte, COLR-Version 0,
CSS-/HTML-Escaping und Canvas-Fallback. Der Electron-Test mit dem ausgelieferten
EFB-HTML prüft geladene lokale Fonts, 14px-Checkboxen, Label-Klicks, dynamische
ZWJ-Symbole sowie 784px-/440px-Menügrenzen; Screenshots wurden geprüft.
Der bestehende Navigations-/Prediction-/RTE-/HDG-Test besteht ebenfalls.
Windows-Test-EXE `/tmp/GA-Tracker-efb-font-check.exe` erfolgreich gebaut.
Assetrevision 39902 ist ein lokaler Folgestand; noch kein Rollout. Der tatsächliche
MSFS-/Coherent-Sichttest steht aus.

Ergänzung auf Nutzerwunsch: Auch die bisher extern geladenen Original-App-Fonts
DSEG7 Classic Bold 0.46.0, Caveat 600, Oleo Script 400/700 und Share Tech Mono
werden lokal als statische TTF gebündelt. Der Kompass behält MS33558. Nur beim
Ausliefern der EFB-Styles entfallen die Google-Fonts-Imports und die externe
DSEG-WOFF2-Quelle; die ursprünglichen Familien und Gewichte bleiben erhalten.
Noto Sans Math schließt zusätzlich die durch direkte cmap-Prüfung gefundenen
Lücken für Minuszeichen und Pfeile (−, →, ↻). Die reine Electron-Sichtprüfung
hatte diese zunächst durch Systemfont-Fallback verdeckt.

25 Node-Tests prüfen jetzt auch die tatsächlichen Glyphen, statische TTFs ohne
variable Achsen, lokale Originalfont-URLs und unveränderte App-Quellen. Der
EFB-Render-Test lädt alle zehn lokalen Font-Dateien bei blockierten externen
Ressourcen und besteht für 784px und 440px. Noch kein Rollout dieses Folgestands.


### Abschließende Schrift-/Menüprüfung, Release v400 (10.09.2026)

Die Abdeckung umfasst Toolbar, Audio, Anzeige/Untermenüs, Höhenband/Canvas,
Kompass, Kartenpopups, Layer, Seitenmenü mit Checklisten/Frequenzen/Platzdetails,
Manifest/Banner sowie E6B im eigenen iframe. Dynamische HTML-/SVG-Knoten mit
expliziten Schriftstapeln erhalten nun ebenfalls denselben Fallback; der
Adapter verarbeitet hinzugefügte Teilbäume, keine vollständigen DOM-Scans pro
Telemetrietakt. SVG-Inhalte und Inline-Schriftprioritäten bleiben erhalten.
Die bisherigen Zeichenersetzungen (FLIP/X/ASCII-Minus) im Kartentisch-Fragment
entfallen zugunsten der Originalsymbole aus index.html.

Das Audio-Menü nutzte im EFB bisher den vereinfachten Cockpit-Client-Fallback.
Die bisherigen Inline-Funktionen aus index.html liegen jetzt in der bereits
geteilten map-profile-controls.js. Dadurch verwenden App und EFB dieselbe
Portalpositionierung, Buttonmarkierung und Resize-/Orientierungsbereinigung.
Audio-/Profileinstellungen verlieren ihren Außenklick-Handler nicht mehr nach
einem Innenklick (bisher once-Listener). Keine Änderung der Missionsaktionen.

25 Node-Tests sowie sechs lokale Electron-UI-Läufe bestehen: Font/Audio/E6B,
Anzeige, Sidebar/Layer, Kartentisch, Popups und Navigation/Prediction. Der
Menütest vergleicht Originalquelle und kompiliertes EFB-Modul bei Toggle,
Innen-/Außenklick und Orientationchange; E6B prüft die tatsächlichen geladenen
SVG-Textstapel. Die übrigen Vergleichsläufe prüfen unter anderem Checklisten,
Frequenzen, Platzdetails, AIP-Weitergabe, Toolbar-Handle und Layer-Außenklick.
Schriften laden im Test ausschließlich lokal; MSFS/Coherent bleibt separat
im Feld zu prüfen. Releaseziel: Tracker v400, EFB-Assetrevision 40001,
Web-Cache v1737. Desktop 1.6.10 und das Community-Package bleiben verwendbar.

Rollout: Quellstand 115887ded als Origin-Release v400 veröffentlicht und
Release-Asset über Größe/SHA-256 verifiziert (58.321.367 Bytes,
287129c312ac6d6f62731b6b763dc88d7d1a05ee932e7efb3d6f8221d896b79b).
Alpha-Kanal zeigt auf dieses unveränderte Artefakt; Stable bleibt v356.
Der abschließende Kanal-Push erhöht den Web-Cache auf v1738.


### Alpha v401: Nachbesserung nach dem Symbol-/Seitenmenü-Feldtest vom 10.09.2026

- v400-Feldtest zeigt weiterhin fehlende Glyphen. Farbfont-Unterstützung neuerer
  Coherent-Produkte darf nicht für MSFS vorausgesetzt werden. EFB-Symbole werden
  daher aus den bereits lizenzierten Fonts als lokale SVG-Pfadgrafiken exportiert;
  HTML-Text bleibt erhalten. Gemeinsames Profil nutzt in der EFB-Kompilierung
  dieselben Grafiken für Canvas-Icons, auch in gemischten Labels.
- Shared-Drawer behält die App-Breiten 86vw/max.390px bzw.94vw/max.420px. Der EFB
  berechnet das bisherige CSS-min-Ergebnis in Pixeln (inkl. Scrollbarbreite), ohne
  die gemeinsamen Quelldateien oder Menünavigation zu verändern. Warnungs-/Radio-
  Zeilen erhalten die gleichen Spaltenmaße per Flex; E6B-Flip behält die App-Größe.
- `font-ui-probe` protokolliert Assetstand, geladene Symbolgrafiken, Theme,
  Drawerbreite und Font-API/CSS-min-Unterstützung. Keine Telemetrie-Scans.
- Nachweis lokal: getrennte Browser-Session blockiert zusätzliche Fonts; Icons
  und Text bleiben erhalten. Breitenvergleich gegen die unveränderte CSS-Regel
  bei 440/590/894px, gemeinsame Menü-/Sidebar-Interaktionen und Canvas-Labels.
  Dies ersetzt **keinen** MSFS-Test. SVG-Text/native Select-Optionen bleiben auf
  Fontdarstellung angewiesen; kein vollständiger Glyphenersatz für diese Flächen.

Tracker v401 enthält Assetrevision 40101. Das bestehende EFB-Community-Paket
und der Desktop-Installer 1.6.10 können diesen Host unverändert laden.

### 11.09.2026: Feldbefund v401 – Symbole und Karteninstrumente (lokale Korrektur)

Der neue Trackerlog belegt die Ursache des Symbolausfalls: `symbols.js` und
alle 231 Basisgrafiken werden geladen (`loadedSymbols=233` einschließlich
Farbvarianten), `emoji-text.js` scheitert dagegen mit `Unexpected identifier
'code'` in Zeile 1. Der Server erzeugte den Browser-Fonthelfer über
`fontFallback.toString()`. In pkg-Bytecode liefert dies `[native code]` und
keinen auslieferbaren JavaScript-Quelltext. Der gemeinsame Helfer liegt jetzt
als explizites Quelltext-Asset vor; Node und Browser verwenden dieselbe Datei.
Keine zusätzliche Schrift-/Unicode-Heuristik oder periodischen DOM-Scans.
Der Log zeigt außerdem einen Coherent-Parserfehler bei `!await unlock()`;
die gemeinsame Audio-Player-Datei klammert das Await-Ergebnis jetzt explizit.

Weitere verifizierte Korrekturen:
- E6B: explizite Coherent-Pixelmaße werden mit der Zeichenauflösung erhöht.
  Zuvor blieben sie fest, während die Gegenskalierung kleiner wurde; daher
  schien Plus an den Auflösungsgrenzen zu verkleinern. Der zusätzliche EFB-
  Faktor 0.7 entfällt. Außenring-Pan nutzt dieselben Trefferradien wie die App
  (Front 0.36–0.58 der Referenzbreite; Wind 240–286 SVG-Einheiten).
- Uhr/Rechner: gleiche Maus-Fallbacks neben Pointer-Events; Verschieben löst
  keine Dial-Aktion aus, Pointer-Cancel startet keinen Timer. Die vorhandene
  Uhr-Größenwahl wird auf 50/100/150/200 Prozent erweitert; der Rechner erhält
  denselben Größenknopf. Beide Oberflächen übernehmen die gemeinsamen Änderungen.
- Uhr: 60 Teilstriche werden im EFB als SVG-Geometrie mit den vorhandenen
  Radien/Farben gezeichnet, statt conic-gradient und CSS-Masken vorauszusetzen.
- E6B-Kontrast: vorhandene Workbench-SVGs verwenden `xlink:href` ohne xmlns:xlink.
  HTML-Insertion toleriert das, der XML-Parser der Halo-Korrektur nicht. Die
  fehlende Namespace-Deklaration wird ergänzt. Coherent erhält getrennte Halo-
  und Tintenschichten in den originalen Farben statt paint-order vorauszusetzen.

Recherchebasis: Coherent GT dokumentiert TTF, TTC und OTF sowie separate Dateien
für Fett/Kursiv (keine garantierte Synthese fehlender Schnitte):
https://coherent-labs.com/Documentation/cpp-gt/dd/d09/font_usage.html
Das ist keine pauschale MSFS-Unicode-Whitelist. Normale Schriftzeichen hängen
von Fontabdeckung und geladenem Schnitt ab; Emoji-/UI-Symbole werden durch die
lokalen SVG-Pfade von diesen Font- und Farbschriftabhängigkeiten getrennt.
SVG-Text und native Select-Optionen bleiben Schrifttext. Moderne Gameface-
Dokumentation ist weiterhin kein Beleg für die konkrete MSFS-Engine.

Nachweise: `tools/efb-packaged-font-smoke.cjs` wurde mit dem Tracker-pkg-Manifest
als node18-macos-x64-Binary gebaut und ausgeführt: `packaged=true`,
`helperSourceStripped=true`, `ok=true`. Dies prüft reale Bytecode-/Asset-
Auslieferung, ersetzt aber keinen Windows-/MSFS-Test. Der Instrumententest
`tools/efb-utility-input-ui-selftest.cjs` prüft echte Mausereignisse, Dial-Aktionen,
Größenwahl, Pan und monotones Zoom auf beiden E6B-Seiten sowie die tatsächlichen
Workbench-Labels (180 Halo-Zahlen, dunkle Füllung, kein überlagernder Strich).
Der erste parallel zu Electron gestartete Audio-Test überschritt seinen festen
700-ms-Testzeitraum; isoliert bestehen alle 38 EFB-/Audio-Tests. Der In-Sim-Sicht-/Bedienungstest bleibt offen.

Abschlussprüfung: Instrumenttest (einschließlich Pointer-Cancel und unterdrücktem
Doppel-Klick durch kompatible Mausereignisse), Font-/Audio-Menütest mit gesperrten
Font-Downloads und Seitenmenü-/Layer-Differentialtest bestehen. Gemeinsame
Drag-/Skalierungsfunktionen sind in App und EFB-Fork textgleich. Die Uhr-Skala
liegt als eigenes lokales SVG-Asset vor; Screenshot wurde visuell geprüft.
Rollout am 11.09.2026: Tracker v402 ist als Origin-Release veröffentlicht;
GitHub-Asset und erneuter Download sind per Größe und SHA-256 verifiziert.
Alpha-Kanal v402, EFB-Assetrevision 40201, Web-Cache v1742. Das vorhandene EFB-Community-Paket kann unverändert bleiben.
EXE: 59059143 Bytes, SHA-256 7902b1d34e84bb0f0c6ebabad1747057d613841002f0ef14f1a99d21eedc4684.
