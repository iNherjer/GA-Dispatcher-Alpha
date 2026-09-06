# Mission Runtime Authority Contract

Stand: 20.08.2026

Dieses Dokument ist der verbindliche Ziel- und Migrationsvertrag fuer die
Missionsausfuehrung. Es ergaenzt die fachlichen Ablaeufe aus
`Mission Flow Reference.md` und die Transportarchitektur aus
`EFB-Tracker-Architecture.md`.

Bei einem Widerspruch zwischen einer experimentellen Tracker-Implementierung
und dem heute sichtbaren Verhalten der Web-App gilt bis zum abgeschlossenen
Paritaetsnachweis die Web-App als Referenz. Die Migration darf bestehende
Missionsregeln nicht ungefaehr nachbilden oder durch vereinfachte Ersatzregeln
ersetzen.

## 1. Ziel in einem Satz

Der Tracker ist das Hirn der laufenden Mission; Web-App, EFB und Toolbar-Panel
sind gleichberechtigte Interfaces fuer genau denselben autoritativen Zustand.

Das bedeutet insbesondere:

- Der Tracker misst Telemetrie, Zonen und Zeiten und entscheidet ueber
  Phasenuebergaenge, Cargo, Pax, Boarding, Deboarding, Voice und Abschluss.
- App, EFB und Panel zeigen denselben Zustand, dieselben Texte, Banner, Labels,
  Aktionen und Blockierungsgruende.
- Ein Client sendet nur eine Benutzerabsicht. Er veraendert keinen fachlichen
  Zustand optimistisch und entscheidet nicht selbst, ob die Aktion erlaubt ist.
- Erst ein akzeptierter Tracker-Intent und der danach verteilte Snapshot
  veraendern alle offenen Interfaces.
- Es gibt pro Missionslauf genau eine Ausfuehrungsautoritaet.

## 2. Verhaltensreferenz und Gleichheitsforderung

Die ausgereifte Web-App ist die Referenz fuer:

- Missionsphasen, Unterphasen, Gates und Sonderfaelle
- Manifest, Cargo-, Equipment- und Pax-Zustaende
- Signaturen und deren Invalidierung
- Boarding-, Deboarding-, Pickup-, Handoff- und Farewell-Reihenfolge
- Szenenbefehle, Animationen, Timings und ACK-Folgen
- Voice-Trigger, Prioritaet, Abbruch und Duplikatunterdrueckung
- sichtbare Banner, Dialoge, Buttons, Labels, Hinweise und Fehlermeldungen
- Restore, Reload, Abschluss, Abbruch und Sackgassen-Recovery

"Paritaet" bedeutet nicht nur dieselbe grobe Phase. Bei identischen Eingaben
muessen App- und Tracker-Ausfuehrung dieselben fachlichen Ergebnisse erzeugen:

1. identischer normalisierter Missionszustand,
2. identischer Manifest- und Pax-Zustand,
3. identische erlaubte Aktionen und Blocker,
4. identisches kanonisches UI-Modell,
5. identische deklarative Szenen- und Voice-Effekte,
6. identische Reihenfolge der fachlichen Ereignisse,
7. identisches Verhalten bei Reload, Wiederholung und Fehlern.

Die vorhandenen experimentellen Dateien `mission-execution-core.js`,
`tracker-mission-execution-runtime.js` und die Tracker-EFB-Projektion sind ein
Migrationsprototyp, nicht die neue fachliche Wahrheit. Wo sie das App-Verhalten
nur reduziert oder angenaehert abbilden, werden sie gegen extrahierte
App-Logik ersetzt oder erweitert. Ein bestehender Tracker-Test allein beweist
keine App-Paritaet.

## 3. Zwei klar getrennte Betriebsarten

Die Betriebsart wird vor der ersten fachlichen Mutation eines Runs bestimmt
und danach fuer diesen Run nicht still gewechselt.

### 3.1 Legacy-/Web-Authority

Wenn die Tracker-Ausfuehrung nicht freigegeben ist:

- bleibt die bestehende Missionslogik in der App aktiv,
- bleiben deren bisherige Trigger, Cargo-, Pax-, Voice- und UI-Ablaufe aktiv,
- bewirbt der Tracker keine schreibende Mission-Intent-Capability,
- fuehrt der Tracker keine Missions-State-Machine und keine daraus
  resultierenden Effekte autoritativ aus,
- darf ein Shadow-Vergleich nur beobachten und protokollieren,
- darf EFB/Panel keine zweite Missionsautoritaet erzeugen.

Dieser Pfad ist ein Kompatibilitaetsvertrag. Arbeiten am Tracker-Pfad duerfen
ihn nicht sichtbar oder fachlich veraendern.

### 3.2 Tracker-Authority

Nur wenn alle Gates erfuellt sind, darf ein APT-Run an den Tracker uebergeben
oder dort aus einem freigegebenen Cloud-Seed gestartet werden:

1. Tracker-Kanal ist `alpha`.
2. Die EXE-Einstellung "Experimentelle APT-Missionsausfuehrung" ist aktiv und
   startet den Tracker mit `VFR_MULTITOOL_APT_EXECUTION=1`.
3. Der Tracker bewirbt die erforderliche versionierte Intent-Capability.
4. Das Missionsrezept ist fuer diese Ausbaustufe explizit freigegeben.
5. Seed, Schema und Effektplan sind vollstaendig und gueltig.
6. Eine App-Uebergabe hat Prepare und Commit atomar bestaetigt, oder der
   Tracker hat den Cloud-Run atomar selbst angelegt.

Ab diesem Zeitpunkt gilt fuer den gesamten Run:

- Nur der Tracker mutiert Mission, Manifest, Pax und Effektzustand.
- Die App stoppt ihre fachlichen Detektoren und Seiteneffekte fuer diesen Run.
- App, EFB und Panel senden ausschliesslich revisionsgebundene Intents.
- Ein fehlgeschlagener Intent faellt nicht lokal auf alte App-Logik zurueck.
- Ein Tracker-Ausfall fuehrt in einen sichtbaren Wiederaufnahmezustand, nicht
  zu einer zweiten Autoritaet.
- Rueckkehr zu Web-Authority ist nur vor dem ersten Tracker-Execution-Event
  als expliziter Rollback oder nach einem abgeschlossenen/abgebrochenen Run
  zulaessig.

### 3.3 Gate-Matrix

| Tracker | EXE-Schalter | Rezept/Handshake | Autoritaet | Verhalten |
|---|---:|---|---|---|
| Stable | beliebig | beliebig | App | bisheriger App-Ablauf |
| Alpha | aus | beliebig | App | bisheriger App-Ablauf |
| Alpha | an | Capability fehlt | App | kein teilweiser Tracker-Modus |
| Alpha | an | Rezept nicht freigegeben | App | bisheriger App-Ablauf |
| Alpha | an | Handoff/Seed ungueltig | App | unveraendert bleiben, Fehler protokollieren |
| Alpha | an | APT freigegeben und Commit erfolgreich | Tracker | App/EFB/Panel sind Interfaces |

Der Schalter ist kein Schalter fuer einzelne Buttons. Er aktiviert nur die
Moeglichkeit einer atomaren Tracker-Authority. Es darf keinen Zustand geben,
in dem beispielsweise Cargo vom Tracker, Voice von der App und der
Missionsabschluss wieder von beiden ausgefuehrt werden.

### 3.4 Explizites Ersetzen und Hard-Lock-Recovery

Ein bewusst vom Benutzer ausgeloester App-Befehl `Clear`, `Reset` oder
`Neue Mission erstellen` darf einen aktiven Tracker-Run aushebeln, aber nicht
lokal daran vorbeischreiben. Die App fuehrt dafuer eine atomare Kette aus:

1. Benutzer bestaetigt den Verlust des laufenden Missionsfortschritts.
2. Die App sendet den revisionsgebundenen Tracker-Intent `abort_mission`.
3. Falls der Run die Sim-Zuladung geschrieben hat, stellt der Tracker zuerst
   die vor dem ersten Schreibversuch privat persistierte Payload-Baseline nach
   denselben App-Regeln wieder her. Dazu gehoeren Standardstationen,
   persistente Ausruestung sowie bei der PA-24 Sitz-/Characterbelegung und
   Gepaeck. Danach liest er den Sim-Zustand erneut ein.
4. Der Tracker bereinigt danach alle Simulator- und Szeneneffekte dieses Runs.
5. Nur nach erfolgreicher Bereinigung markiert er den Run als `aborted`, gibt
   die Authority frei und verteilt die neue Revision.
6. Die App verwirft danach ihren lokalen Missions-, Runtime-, Cargo-, Pax- und
   Briefingzustand.
7. Erst danach darf Clear/Reset enden oder die Erzeugung der neuen Mission
   beginnen.

Falls ein bereits terminaler Run aus einem Fehlerfall noch eine unaufgeraeumte
Missionszuladung im Simulator hinterlassen hat, uebernimmt der erste
Payload-Sync eines kompatiblen Ersatz-Runs dessen privat persistierte
Vor-Missions-Baseline. Er schreibt daraus direkt das neue Manifest; alte
Missionsfracht wird daher ersetzt und nicht als neue Baseline mitaddiert.
Persoenliche beziehungsweise persistente Bordausruestung bleibt Teil dieser
Baseline. Bei abweichendem Flugzeug, Payload-Adapter oder Station-Layout wird
die alte Baseline aus Sicherheitsgruenden nicht uebernommen.

Schlaegt Abbruch, Szenenbereinigung oder Authority-Freigabe fehl, wird keine
neue Mission erzeugt und der bestehende Run bleibt sichtbar wiederholbar. Der
Benutzer muss die urspruengliche Aktion nach einem erfolgreichen Abbruch nicht
ein zweites Mal anklicken.

Ein normaler Browser-/App-Seitenreload ist kein Clear-Befehl. Er verbindet das
Interface wieder mit dem laufenden Tracker-Run und darf die Mission nicht
automatisch abbrechen. Nach dem Reload bleiben die ausdruecklichen Clear-,
Reset- und Neue-Mission-Aktionen als Recovery verfuegbar.

### 3.5 Lokaler Desktop-Hard-Reset

Der Tracker-Desktop darf fuer einen festgefahrenen **Tracker-authoritativen**
APT-Run einen separat bestaetigten Hard-Reset anbieten. Er ist kein zweiter
fachlicher Resetpfad: Er sendet intern zuerst denselben `abort_mission` mit
Payload-Restore und Szenenbereinigung. Nur nach dessen Erfolg entfernt er den
lokalen Authority-LastRun, Effect-/Shadow-Recovery und die zugehoerige
Tracker-Projektion; Flightlog und die Cloud-Mission der App bleiben erhalten.
Danach liest der Tracker den aktuellen Cloud-Seed neu ein. Ist die sichere
Bereinigung nicht moeglich, bleibt der Run erhalten und der Desktop meldet den
Blocker statt ihn gewaltsam zu verwerfen. Der Endpunkt ist ausschliesslich an
Loopback gebunden und durch ein pro Trackerprozess erzeugtes Desktop-Token
geschuetzt; weder App noch EFB erhalten dieses Token.

## 4. Verantwortungsgrenzen im Tracker-Modus

### 4.1 Tracker: fachliche Autoritaet

Der Tracker besitzt und persistiert:

- `missionId`, `runId`, Rezept, Phase, Unterphase und monotone Revision,
- alle Flug-, Zonen-, Dwell-, Stillstand- und Timing-Fakten,
- das vollstaendige Manifest mit Cargo, Equipment, Pax und Signaturen,
- alle erlaubten Aktionen und Blockierungsgruende,
- laufende Operationen mit stabiler `operationId`,
- deklarative Szenen-, Payload-, Voice- und Abschluss-Effekte,
- Effect-Dispatch und ACK-/Fehlerzustand,
- Wiederaufnahmeinformationen und bereits verarbeitete Command-/Event-IDs,
- das kanonische UI-Modell fuer den aktuellen Snapshot.

Der Tracker validiert jeden Intent gegen Sitzung, Mission, Run, erwartete
Revision, aktuelle erlaubte Aktionen und einen stabilen `commandId`. Eine
wiederholte Anfrage ist idempotent; eine veraltete Revision mutiert nichts.

### 4.2 App, EFB und Toolbar-Panel: Interfaces

Die Interfaces duerfen:

- Tracker-Snapshots darstellen,
- Dialoge oeffnen und schliessen,
- Karte, Zoom, Scrollposition und Host-Lifecycle lokal verwalten,
- eine Benutzerabsicht mit aktueller Revision senden,
- den lokalen Audio-Playback-Owner waehlen und Audio wiedergeben,
- Busy-, Fehler- und Reconnectzustand darstellen.

Sie duerfen nicht:

- Missionsphasen oder Manifeststatus direkt setzen,
- Zonen, Zeiten oder Erfolg selbst bewerten,
- nach einem Timeout lokal eine Aktion als erfolgreich behandeln,
- Boarding, Deboarding, Voice oder Missionsabschluss doppelt ausloesen,
- Trackerzustand mit einem aelteren lokalen Snapshot ueberschreiben.

## 5. UI-Vertrag

Die Migration ist kein UI-Redesign. Die bestehende App definiert den
fachlichen Inhalt und das Verhalten der sichtbaren Oberflaeche:

- Texte und Schreibweise,
- Button- und Bannerlabels,
- Reihenfolge und Gruppierung von Aktionen,
- sichtbar, verborgen, aktiv, deaktiviert und busy,
- Statuszeilen, Hinweise und Fehlermeldungen,
- Verlade-Manager, Missionsfenster und Kartenbanner,
- visuelle Boarding-/Deboarding- und Fortschrittsdarstellung.

Dafuer wird eine reine gemeinsame Presentation-Funktion aus der vorhandenen
App extrahiert:

```text
authoritativer MissionState + FlightView + OperationState
                         |
                         v
             kanonisches MissionUiModel
                         |
              +----------+----------+
              |          |          |
             App        EFB       Toolbar
```

Im Web-Authority-Modus berechnet die App dieses Modell lokal. Im
Tracker-Authority-Modus berechnet der Tracker dieselbe Funktion und verteilt
das Ergebnis. Die Hosts rendern das Modell mit gemeinsamen Komponenten und
Textressourcen. Nur responsive Abmessungen, Fenster-Chrome, Fokus und
Host-Navigation duerfen abweichen.

Ein UI-Modell enthaelt mindestens:

- aktuellen Banner oder `none`, inklusive Prioritaet und Aktion,
- Missions- und Verlade-Dialogzustand,
- geordnete Action-IDs mit exakt aufgeloesten Labels,
- Cargo-/Pax-Zeilen mit Status und Bedienbarkeit,
- Signaturstatus und erlaubte Signaturaktion,
- Busy-Operation und sichtbaren Fortschritt,
- stabile Fehlercodes und deren kanonische sichtbare Texte,
- Voice-/Playbackstatus.

Rohfehler wie `mission_manifest_unload_not_allowed` duerfen nicht direkt als
Benutzertext erscheinen. Sie werden durch den gemeinsamen Textkatalog in die
bisherige sichtbare App-Meldung uebersetzt.

## 6. Cargo-, Pax- und Signaturvertrag

Das bestehende App-Manifest bleibt die fachliche Referenz. Vor der
Tracker-Freigabe wird sein vollstaendiges Schema dokumentiert und extrahiert:

- alle Itemtypen, Statuswerte und Pflichtfelder,
- Pickup- und Delivery-Rollen,
- Required-, Equipment- und Handoff-Semantik,
- Pax-Gruppengroesse, Sitz-/Payloadzuordnung und Gewicht,
- Condition, Lost, Dropped und missionsspezifische Folgen,
- Departure-, Pickup- und Arrival-Signatur,
- jede Aenderung, welche eine bestehende Signatur invalidiert,
- exakte Gates fuer Load, Start, Pickup, Unload, Farewell und Close,
- Migration und Restore alter Manifestversionen.

Jeder Item-Klick ist ein Intent. Der Tracker akzeptiert oder verwirft die
gesamte Transition atomar und sendet danach das neue Manifest. Alle offenen
Clients zeigen dieselbe Revision; keiner toggelt ein Item zunaechst lokal.

## 7. Boarding, Deboarding und Szeneneffekte

Die bestehenden Sequenzen aus App, Szenen-Buildern und Trackerhandlern werden
nicht neu erfunden. Sie werden als versionierte Effekt-Rezepte extrahiert und
mit Golden Tests gesichert. Der Vertrag umfasst mindestens:

- Spawn-/Door-/Target-Punkte und alle Fallbacks,
- Einzel- und Gruppen-Pax,
- Personen-, Cargo- und Fahrzeugmodelle,
- Gehgeschwindigkeit, Stagger, Wartezeiten und Final Hold,
- Tuer oeffnen, halten und schliessen,
- Cargo-Aufnahme, Entfernung, Uebergabe und Rueckgabe,
- Farewell-Gate vor Deboarding,
- Cue-Stufen und Voice-Koordination,
- Busy, Noop, Fehler, Timeout, Neustart und ambiges ACK,
- Zeitpunkt, zu dem der fachliche Pax-/Cargo-Status wirklich wechselt.

Der Mission Core erzeugt einen deklarativen Effekt. Nur der Tracker fuehrt den
Simulator-Effekt aus. Der fachliche Zustand schreitet erst an der im heutigen
App-Ablauf vorgesehenen ACK-Stufe fort.

## 8. Voice-Vertrag

Im Tracker-Modus entscheidet nur der Tracker ueber Voice-Trigger und Queue.
Die aus der App zu extrahierende Policy umfasst:

- Trigger und Voraussetzungen,
- Persona, Kontext und aufgeloesten Text,
- Prioritaet, Deduplizierung und Cancellation-Epoch,
- Preload, Fallback und spaete TTS-Antworten,
- Boarding-/Farewell-/Deboarding-Gates,
- genau einen Playback-Owner pro Effekt.

Ein aufgeloester Voice-Auftrag erhaelt eine stabile `effectId` und wird
persistiert. Mehrere Interfaces duerfen ihn sehen, aber nur das als
"Audio auf diesem Geraet abspielen" ausgewaehlte Interface gibt ihn wieder.
Ein Ownerwechsel erzeugt keine zweite Synthese und keinen zweiten
Missionsfortschritt.

## 9. APT als erster vertikaler Schnitt

Die erste Tracker-Authority umfasst nicht nur einen Teil des APT-Ablaufs,
sondern einen vollstaendigen, einfachen A-nach-B-Run:

1. geplante Cloud-Mission erkennen und vorbereiten,
2. Szene vorbereiten,
3. Verlade-Manager mit Cargo, Pax und Departure-Signatur,
4. Boarding und Load-Confirm,
5. Mission starten und Airborne erkennen,
6. APT-Ankunft, Touchdown und Ground-Still erkennen,
7. Unload, Pax-Deboarding, Arrival-Signatur und Farewell,
8. Missionsabschluss und bestehendes Debrief,
9. Reload und Tracker-Neustart in jeder kritischen Phase,
10. gleichzeitige Bedienung aus App und EFB.

APT-Sondervarianten werden erst freigegeben, wenn ihr jeweiliger Vertrag und
ihre Golden Tapes vorliegen. POI, Bush, Pickup, Survey, SAR und Training bleiben
bis zu einer eigenen Freigabe in Web-Authority.

## 10. Migrationsreihenfolge

### Stufe A - Verhalten inventarisieren

- Exakte App-Zustaende, UI-Texte, Aktionen und Effekte fuer den APT-Referenzlauf
  katalogisieren.
- Fehlende Cargo-, Boarding-, Deboarding- und Voice-Regeln aus dem produktiven
  Code in diesen Vertrag oder verlinkte Schemadokumente uebernehmen.

### Stufe B - App charakterisieren

- Ereignistapes fuer alle APT-Schritte und Fehlerpfade aufzeichnen.
- Golden Snapshots fuer MissionState, Manifest, MissionUiModel, Effekte und
  sichtbare Texte erzeugen.
- Bestehende App-Ausgabe gilt als erwartetes Ergebnis.
- `tools/apt-legacy-ui-characterization-selftest.mjs` friert als erster
  Charakterisierungstest die bestehenden APT-Kartenbanner vom geplanten Start
  bis zum Debrief ein. Weitere Goldens werden an dieselbe Referenz angehaengt.

### Stufe C - Gemeinsame Kerne extrahieren

- Fachliche Entscheidungen ohne Verhaltensaenderung aus App-Dateien loesen.
- Zuerst verwendet die App die extrahierten Kerne weiterhin als Autoritaet.
- Erst wenn alle Goldens unveraendert bleiben, importiert der Tracker dieselben
  Module.

### Stufe D - Gegatete Tracker-Authority

- Alpha plus EXE-Schalter darf den vollstaendigen APT-Schnitt committen.
- Schalter aus und Stable bleiben auf der App-internen Ausfuehrung.
- Shadow-Auswertung darf weiter vergleichen, aber keine zweite Wirkung haben.

### Stufe E - In-Sim-Paritaet

- Vollstaendiger Lauf mit App und EFB gleichzeitig.
- Tracker-Neustart, UI-Reconnect und doppelte/veraltete Intents testen.
- Szenen, Animationen, Voice, Cargo und Abschluss mit dem Referenzlauf
  vergleichen.
- Erst nach dokumentiertem PASS wird das naechste APT-Rezept begonnen.

Redigierte Real-Logs duerfen zusaetzlich als Zeit- und Reihenfolgeprofil fuer
einen lokalen Dry-Run verwendet werden. Nicht enthaltene Manifest-, Positions-
oder Effektpayloads muessen aus einem benannten kanonischen Fixture stammen;
sie duerfen nicht aus Hashes erraten werden. Ein synthetisch forcierter Zweig
belegt Core-, Restart-, Duplicate- und UI-Verhalten, ersetzt aber keinen realen
In-Sim-Effekt- oder Mehrinstanznachweis.

## 11. Pflichtgates fuer jede APT-Aenderung

Eine APT-Tracker-Aenderung darf nur ausgerollt werden, wenn:

1. Stable und Alpha mit ausgeschaltetem EXE-Schalter dieselben Legacy-Tests
   bestehen,
2. kein `mission.intent.v1` ohne Alpha plus EXE-Schalter beworben wird,
3. ein fehlgeschlagener Handoff keine lokale Logik halb deaktiviert,
4. App und Tracker dieselben Golden Tapes bestehen,
5. App, EFB und Panel aus derselben Trackerrevision rendern,
6. wiederholte Intents und ACKs keine doppelte Wirkung erzeugen,
7. ein Neustart keine Szene, Voice oder Cargoaktion doppelt ausfuehrt,
8. der komplette APT-Lauf inklusive Abschluss und Debrief funktioniert,
9. der dedizierte Testlog Autoritaet, Revision, Intent, Effekt und ACK eindeutig
   erkennen laesst,
10. keine UI-Texte, Labels oder Aktionsergebnisse gegenueber der Referenz-App
    unbeabsichtigt veraendert wurden.

## 12. Nicht zulaessige Abkuerzungen

- keine zweite vereinfachte Cargo- oder Missionslogik im Tracker,
- keine UI-Sonderregeln im EFB-Host fuer fachliche Freigaben,
- kein lokaler Cargo-Toggle vor Tracker-ACK,
- kein Mischen von Web- und Tracker-Seiteneffekten in einem Run,
- kein automatischer Fallback zur App nach dem ersten Tracker-Event,
- keine Freigabe nur aufgrund gleicher Phasennamen,
- keine neue Sonderfallregel, wenn die vorhandene App-Regel extrahiert werden
  kann,
- kein Loeschen der Legacy-Logik vor vollstaendiger Paritaet und Stable-
  Promotion.

## 13. Aktueller technischer Abstand zum Ziel

Der Stand vom 21.08.2026 erfuellt den Transport-, Gate- und
Authority-Unterbau, aber noch nicht den Gleichheitsvertrag:

- `mission-manifest-core.js` ist als erster gemeinsamer Baustein extrahiert.
  Die Web-App verwendet ihn bereits fuer Passenger-/Handoff-Erkennung,
  Signatur-Scope und -Invalidierung, Pickup-Verfuegbarkeit,
  Destination-/Home-Unload sowie die Pflichtgates in Verlade-Manager, Load,
  Pickup und Unload. Load, Unload, Drop, Reload, Zurueck-auf-Pending und
  Sign/Unsign werden bereits als planbare, konfliktgepruefte Core-Transitionen
  ausgefuehrt. Passenger-Transitionen benennen den erforderlichen Effekt,
  werden aber bis zum gemeinsamen Szenenrezept weiterhin durch die exakte
  App-Animation committed. Node- und Browser-Goldens sichern denselben
  APT-Zustand. Ein zusaetzlicher Differentialtest fuehrt die wirklichen
  App-Fallbackfunktionen mit und ohne gemeinsamen Core aus. Der Tracker
  transportiert inzwischen das vollstaendige Manifest statt einer
  verlustbehafteten Cargo-Kopie. Payloadplanung, begrenzte Ergebnisprojektion,
  inkrementelle Cargo-/Pax-Wirkungen und der App-identische Abort-/Reset-
  Rueckbau sind als gemeinsame Bausteine extrahiert.
- `mission-apt-ui-core.js` ist die erste kanonische APT-UI-Projektion. Sie
  liefert fuer App und EFB aus demselben Tracker-Control- und Manifeststand
  Bannertext, Buttonlabel, CSS-Zustand, Cargo-Item-Aktion, Signatur- und
  Bestaetigungsaktion sowie Blockertext. Der ausfuehrbare
  App-Differentialtest vergleicht Planned, Prepare, Boarding-Wait,
  Verladefenster, Boarded, Unload, End-ready, Deboarding und Debrief direkt
  mit `_updateMissionStartBanner()`. Fuer den Standard-APT-Verladeablauf
  projiziert derselbe Core inzwischen auch die App-Struktur der Frachtgutliste:
  Kopf und Hilfetext, sechs Tabellenspalten, Status- und Aktionslabel je Item,
  PAX-Sperre, Pilotensignatur, Signaturloeschen, Primaeraktion, Gewichtssumme,
  Payload-Ergebnistext und erklaerte Tracker-Sperre. Ein zweiter ausfuehrbarer
  Differentialtest fuehrt dafuer die echte `_missionCargoRenderDialog()`-
  Funktion in Load-, Signed-, Animating-, Boarded-, Unload- und
  PAX-Endzustaenden aus. Der EFB rendert nur noch dieses Modell; sein alter
  Cargo-Code ist ausschliesslich Kompatibilitaetsfallback fuer aeltere
  Snapshots. Die App verwendet bei Tracker-Authority weiter ihr vorhandenes
  DOM und fuehrt nun auch nach einem Tracker-Signatur-ACK dieselbe 1,6-s-
  Schreibanimation aus. Bordbuch-Start-/Landeeintrag und der Austausch von
  Ablauf-Equipment verwenden inzwischen ebenfalls gemeinsame Manifest-
  Transitionen und revisionsgebundene Tracker-Intents. Reine Fracht-Pickups
  koennen App-identisch bestaetigt werden; Profil und Pickup-Art bestimmen
  denselben Banner- und Hilfetext wie im App-Pfad. Der Tracker liest waehrend
  eines aktiven APT-Laufs alle fuenf Sekunden die reale Sim-Payload und
  projiziert daraus begrenzt Gesamt-, Leer-, Fuel-, Pax-, Cargo-, Missions-
  und Stationsgewichte an App und EFB. Roh-SimConnectdaten bleiben privat.
  Passenger-Pickup mit Boarding-Szene und der reale Mehrinstanz-Gesamtlauf
  bleiben Teil des noch offenen Nachweises. Der Standard-APT-Compliance-
  Einschub verwendet inzwischen dieselbe kanonische UI-Projektion; sein realer
  App-/EFB-/Restart-Nachweis bleibt ebenfalls offen.
- `mission-execution-core.js` behaelt das vollstaendige App-Manifest und nutzt
  fuer Item-, Passenger- und Signaturtransitionen denselben Manifest-Core.
  Die zuvor automatisch verkuerzte Startfolge wurde wieder in Vorbereitung
  und den separaten Benutzerintent `start_boarding` getrennt.
  `mission-start-core.js` enthaelt inzwischen die aus dem App-Pfad
  extrahierte Reihenfolge fuer Departure-Manifest, Signatur, Payload-Busy,
  Payload-Abschluss und das gemeinsame Start-ready-Gate. App und Tracker-Core
  verwenden dieselben Entscheidungen; ein ausfuehrbarer Differentialtest
  vergleicht die Start-ready-Promotion mit dem weiterhin vorhandenen
  App-Fallback. Im Tracker sind Szene, Boarding-Voice und Payload nun drei
  getrennte ACK-Grenzen:
  `scene.boarding -> BOARDING_SCENE_CONFIRMED`,
  `voice.boarding -> BOARDING_CONFIRMED` und
  `payload.sync_before_start -> LOAD_CONFIRMED`. Weder Szenen-ACK noch der
  Benutzerintent `confirm_load` koennen damit allein `boarded` erzeugen.
  `mission-payload-core.js` enthaelt nun unveraendert die bisherige
  App-Verteilung fuer Standardstationen und PA-24: Pax-Fallback,
  Sperrgutverteilung, Sitz-/Characterbelegung, Gepaeck- und Grossgewichtslimit
  sowie Stations- und PA-24-Stabilitaetsvergleich. Die App verwendet diesen
  Core; ein Differentialtest vergleicht ihn direkt mit den weiterhin
  vorhandenen Fallbackfunktionen. Der Tracker liest dieselbe SimConnect-
  Baseline, schreibt denselben Plan, fuehrt die bisherigen Wartezeiten und
  PA-24-Sitz-Reasserts aus und behaelt bei Flugzeugablehnung den vorhandenen
  App-Override statt einen Hard-Lock zu erzeugen. Plan, Readback, Override und
  Fehler werden nun begrenzt im autoritativen Replay persistiert; App und EFB
  rendern daraus denselben aus dem App-Code uebernommenen Status- oder Warntext.
  Roh-SimConnect-Snapshots und einzelne Mismatchdaten verlassen den Tracker
  nicht. Die vor dem ersten Schreibversuch erfasste Baseline bleibt in einem
  privaten, nicht projizierten Authority-Datensatz erhalten und ueberlebt
  einen Tracker-Neustart. Abort, Clear, Reset und Missionsersetzung stellen
  diese Baseline beziehungsweise Baseline plus persistente Ausruestung vor der
  Authority-Freigabe wieder her; ein fehlender Simulator oder Schreibfehler
  behaelt den Run fuer einen Retry. Load, Reload, Unload, Airborne-Drop sowie
  automatische Pax-Boarding-/Deboarding-Transitionen erzeugen jetzt
  `payload.sync_manifest_state`. Wie in der App werden Anfragen 500 ms
  entprellt, nach hoechstens zwei Sekunden ausgefuehrt und als Single-Flight
  auf den neuesten Manifeststand zusammengezogen. Signieren und Entsignieren
  erzeugt keine Payload-Wirkung. Das Abtrennen geerbter permanenter
  Ausruestung wird vor der Queue privat und neustartfest in derselben Baseline
  gespeichert. SimConnect-Trennung bricht eine alte Queue ab und gibt die
  persistierten Effekte fuer den sofortigen Reconnect-Dispatch frei.
  `voice.boarding` ist nun an einen zentralen, neustartfest deduplizierten
  Tracker-Job angebunden. Textprompt, Fallback, Training-Validierung,
  Sprecher- und Modellreihenfolge stammen aus demselben gemeinsamen Core wie
  die App. Das gilt auch fuer reine Cargo-Missionen, fuer die der Legacy-Pfad
  ebenfalls eine Loadmaster-Ansage erzeugt. Bei PAX wird der nach App-Regeln
  deterministisch gewaehlte Boarding-Cue mit Gain `0.38` vor dem TTS-Stream
  auf derselben exklusiven Playback-Lease wiedergegeben; bei Tracker-Authority
  ist der alte lokale App-Cue gesperrt. Fehlender Provider, Cue, Audioclient
  oder lokaler Playbackfehler bleibt wie in der App best effort und darf kein
  Boarding-Hard-Lock erzeugen. Zu diesem Stand waren die koordinierten
  Farewell-/Deboarding-Stufen und das kanonische UI-Modell noch offen; der
  folgende Migrationsschnitt schliesst die lokale Effektkette, aber noch nicht
  ihren Feld- und Gesamtnachweis.
- Die koordinierte Farewell-/Deboarding-Kette ist lokal nun ebenfalls als
  deklarative Tracker-Effektfolge vorhanden. `scene.deboarding` startet mit
  `coordinateFarewell=true`; erst der Tracker-Stage `cue` erzeugt
  `FAREWELL_STARTED` und `voice.farewell`. Der ausgewaehlte Audioclient spielt
  den nach den App-Regeln gewaehlten Deboarding-Cue mit Gain `0.38` vor dem
  TTS-Stream. Erst das Voice-/Playback-Ende erzeugt
  `scene.deboarding_continue`. PAX bleibt bis zum Handoff- beziehungsweise
  finalen Deboarding-ACK `loaded`; erst danach folgen Manifest-/Payload-Sync
  und Close. Szenen-, Provider-, Playback- und Timeoutfehler bleiben wie im
  App-Fallback best effort und duerfen keinen Abschluss-Hard-Lock erzeugen.
  Ein abgebrochener oder verspaeteter Farewell-Job wird aus der zentralen
  Playback-Queue entfernt und kann nach dem End-Lock nicht mehr abgespielt
  werden.
- `mission-compliance-domain-core.js` enthaelt die aus dem bestehenden
  App-Ablauf extrahierte Standard-APT-Kontrolle: Auswahlwahrscheinlichkeit,
  unveraenderlichen Flug-Snapshot, Bordbuch-Nachbesserung, Ablaufklassifikation
  mit Drei-Tage-Verwarnungsgrenze, Ergebnistext, Sieben-Tage-Crewboard-Eintrag,
  Cargo-Sperren und die vorhandenen deutschen UI-Texte. Der Legacy-
  App-Orchestrator delegiert diese Entscheidungen an denselben Core.
  `tools/mission-compliance-app-differential-selftest.mjs` fuehrt die
  weiterhin vorhandenen App-Fallbackfunktionen und den gemeinsamen Core fuer
  gueltige Evidence, noch geladene Gegenstaende, im Flug fehlende Ausruestung,
  Bordbuch-Nachbesserung sowie Verwarnung plus Behoerdeneintrag gegeneinander
  aus. Normalisierung, Flug-Snapshot, Texte, Sperren, UI-Projektion und
  Sanktion muessen dabei exakt gleich bleiben. Bei Tracker-Authority fuehrt
  der Replay-Core die verschachtelte Folge
  `Ground-Visit -> Farewell -> Kontrollansage -> Evidence -> Ergebnisansage ->
  Abfahrt -> Close` aus. Ground-Visit und Abfahrt verwenden den bereits
  vorhandenen App-Builder und echte Simulator-Stages/ACKs; der logische
  Szenenfallback und beide Voice-Auftraege bleiben wie in der App best effort.
  Ein Sanktionseffekt wird vor der Ergebnisansage erzeugt und von der App
  idempotent ueber `flightId` in das bestehende Crewboard uebernommen. App und
  EFB erhalten den vollen Compliance-Zustand und dieselben Banner-, Cargo- und
  Nachbesserungstexte. Der Pfad bleibt bis zum realen Force-/Reload-/
  Mehrinstanztest in `compliance_effect_parity` fail-closed.
- Der Standard-APT-Farewell-Textvertrag wird aus `_farewellPreparedContext()`
  ueber `mission-farewell-voice-core.js` unveraendert gemeinsam ausgefuehrt.
  Der Tracker fuehrt dazu denselben Flight-Recorder mit App-Arming-, Pause-,
  Reposition-, GPS-VS-Smoothing- und Aggregatregeln, friert wie die App den
  Farewell-Record am Touchdown ein und setzt den Recorder nach fuenf Sekunden
  stabiler Zwischenlandung fuer einen moeglichen Folgeabschnitt zurueck. Er
  schreibt dabei den abgeschlossenen Flugabschnitt zuerst in einen
  missionsweiten Summendatensatz. Nur der Segmentrecorder wird geleert; Dauer,
  Strecke, Extremwerte, Stichproben und alle vorherigen Abschnitte bleiben fuer
  das Abschluss-Debrief erhalten. Farewell bewertet weiterhin ausschliesslich
  die letzte Landung. Record und letztes Wetter werden privat persistiert und
  erzeugen beim Close aus einer tracker-gehosteten Oberflaeche den
  situationsaktuellen Passenger-, Failure- oder Cargo-Prompt.
  App-Close-Rezepte behalten als aktuelle Eingabe Vorrang; das Handoff-Recipe
  bleibt nur Rueckwaertskompatibilitaets-Fallback. Prompt, Record und Wetter
  werden waehrend des Fluges nicht in den oeffentlichen Execution-State
  projiziert. Erst `closing`/`closed` liefert den kompakten missionsweiten
  Abschlussrecord an die App; in den Ankunftsphasen ist nur die begrenzte
  Zielentscheidung fuer das bestehende Banner sichtbar. Private
  Telemetrie-Persistenz veraendert weder Revision noch `updatedAt`. Zusaetzlich
  schreibt `tracker-flight-log-store.js` jeden Run append-only nach
  `Dokumente/VFR Multitool/Tracker/flightlogs/*.jsonl` und erzeugt am Ende eine
  kleine `*.summary.json`. Rohpunkte bleiben lokal; nur die Summary fliesst in
  den bestehenden App-Debrief- und Cloudpfad. Die lokale
  App-Farewell-Vorbereitung ist bei Tracker-Authority gesperrt, damit kein
  zweiter Providerjob entsteht. POI, Training, Bush/Pickup und SAR-Heli sind
  in diesem Kontextvertrag ausdruecklich `unsupported` und brechen geschlossen
  ab, bis ihre zusaetzlichen Narrative und Auswertungen gleichartig migriert
  sind.
- Der APT-Effektplan wird uebergangsweise in der App aus bestehenden Buildern
  erzeugt und an den Tracker uebergeben. Ziel ist ein gemeinsamer reiner
  Effekt-Recipe-Core, nicht ein zweiter Tracker-Builder.
- Boarding- und Standard-APT-Farewell-Voice-Trigger samt Deboarding-Gate sind
  gemeinsam extrahiert. POI-/Pickup-/Training-/SAR-Sonderrezepte liegen
  weiterhin wesentlich in `passenger-voice.js` und sind noch nicht Teil
  derselben autoritativen Ausfuehrung.
- App und EFB reichen bei Tracker-Authority ausschliesslich Benutzer-Intents
  ein. Das EFB tut dies ueber die lokale Cockpit-HTTP-Session, eine entfernte
  Origin-App ueber das vorhandene PIN-geschuetzte Tracker-Relay. Beide Wege
  verwenden denselben Revision-, Dedupe- und Rate-Limit-Controller. Nach dem
  Commit sendet der Tracker den neuen Authority-Snapshot sofort an alle
  Ansichten; ein zweites Geraet darf deshalb weder einen lokalen Cargo-Toggle
  noch einen veralteten Missionsstand behalten.
- Die obere Missionsleiste ist ebenfalls nur eine Projektion dieses
  Authority-Snapshots. Der primaere Button folgt demselben Banner-/Allowlist-
  Modell, `Verladung` oeffnet den synchronen Manager jederzeit erneut und
  `Mission Reset` sendet nach ausdruecklicher Rueckfrage den sicheren
  `abort_mission`-Pfad. App und EFB verwenden dafuer denselben
  `ga.mission-toolbar.v1`-View. Der Reset setzt keine Phase lokal und darf
  weder Manifest noch SimObjects direkt veraendern; erst Tracker-Cleanup und
  ACK leeren alle verbundenen Ansichten. Im Web-Authority-Fallback bleiben
  die vorhandenen App-Buttons und die bestehende lokale Reset-Logik erhalten.
- Physische Missionsanimationen sind Tracker-Effekte: Entweder die Runtime
  loest sie selbst aus oder ein App-/EFB-Intent fuehrt im Tracker-Reducer zu
  diesem Effekt. Erst der Tracker sendet das Szenenkommando an den Simulator
  und committed PAX/Cargo nach dessen ACK. Kein Client fuehrt Boarding,
  Deboarding oder SimObject-Bewegungen eigenstaendig aus. Reine UI-Effekte wie
  die 1,6-sekuendige Schreibanimation der Manifest-Unterschrift werden aus dem
  autoritativen Signaturzeitpunkt in App und EFB gespiegelt und haben keinen
  Einfluss auf den Simulatorzustand.
- Das bestehende App-Debrief und die lokale Flightlog-Persistenz bleiben fuer
  diese Migration erhalten. Ein identisches Debrief im EFB/Toolbar-Panel sowie
  Flightlog-Explorer, Export und das endgueltige kompakte Cloudmodell sind
  ausdruecklich nachgelagertes Backlog und keine Voraussetzung fuer die
  aktuelle Standard-APT-Mehrinstanzparitaet.

Der bestehende Schalter bleibt experimentell und standardmaessig aus. Fuer den
freigegebenen v378-Alpha-Feldkandidaten sind die gemeinsamen Standard-APT-
Policies und lokalen Effektketten durch Core-, Charakterisierungs- und direkte
App-Differentialtests abgesichert; deshalb meldet der Execution-Core
`TRACKER_AUTHORITY_READY=true`. Schreibende Mission-Intents werden trotzdem
nur angeboten, wenn Alpha-Kanal und Desktop-Opt-in gleichzeitig aktiv sind.
Stable sowie Alpha ohne Opt-in bleiben unter Web-Authority. Der geoeffnete
Gate ist die Voraussetzung fuer den realen Stufe-E-Test, aber kein Ersatz fuer
dessen End-to-End-, Mehrinstanz-, Reload-, Voice-Lease-, Recovery- und
Compliance-Nachweis. Passenger-Pickup, POI, Training, Bush/Pickup und SAR
bleiben fail-closed.

### Feldtest-Nachbesserung nach v1702

- Ein Relay-Intent wird nach erfolgreichem Core-Commit sofort bestaetigt. Lang
  laufende Simulator-, Payload- und Voice-Effekte werden anschliessend vom
  Tracker weiter abgearbeitet und ueber die normale Authority-Projektion
  sichtbar. Ein langsamer TTS-Aufruf darf deshalb keinen falschen
  `authority_timeout` im ausloesenden App-Client mehr erzeugen.
- Ein spaet eintreffendes Intent-ACK darf einen bereits neueren, ueber den
  Authority-Kanal empfangenen `activeRun` nicht mehr zurueckschreiben. App und
  EFB behalten dadurch auch bei parallelen Aktionen stets die hoechste bekannte
  Revision.
- Jede Nicht-PAX-Aenderung am Manifest erzeugt zusaetzlich zum Payload-Sync
  einen persistenten `scene.cargo_item_transition`-Effekt. Laden/erneutes Laden
  entfernt das zugehoerige SimObject aus allen Missionsszenen; Entladen oder
  Abwerfen erzeugt es an der aktuellen Trackerposition. Wie bei den uebrigen
  Szeneneffekten gilt der Zustand erst nach Simulator-ACK als abgearbeitet.
- Passenger bleiben weiterhin ausschliesslich ueber die bestehenden Boarding-
  und Deboarding-Effekte steuerbar; der neue Cargo-Effekt darf diesen Pfad
  nicht umgehen.
