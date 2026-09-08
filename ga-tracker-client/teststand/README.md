# Simulator-Teststand

Entwicklungswerkzeug fuer einen manuellen A–B-Testflug mit dem echten Tracker,
ohne MSFS. Der separate Start ersetzt ausschliesslich `node-simconnect.open()`
durch einen lokalen Simulator-Adapter. `tracker.js`, SimConnect-Datendefinitionen,
Payload-/Scene-Handler, Mission Core, Wartezeiten und ACK-Auswertung laufen aus
dem aktuellen Quellcode. Die normalen Tracker- und Standalone-Starts werden
nicht veraendert. Dies ist noch kein Schalter in der veroeffentlichten EXE.

## Start

Voraussetzung: Node.js und die bereits installierten Tracker-Abhaengigkeiten
(`npm ci` im Verzeichnis `ga-tracker-client`, falls noch nicht vorhanden).
Aus dem Repository-Stamm:

```sh
node ga-tracker-client/teststand/start.js
```

1. Die angezeigte lokale Bedienseite oeffnen: standardmaessig
   `http://127.0.0.1:18789/`.
2. Im Terminal mit einer **separaten Test-Pilot-ID** anmelden. Dieser Modus
   verwendet die normalen Cloud-/Relay-Verbindungen und kann Testmissionen
   und Flugaufzeichnungen im angemeldeten Konto speichern. Keinen zweiten
   Tracker mit derselben ID parallel betreiben.
3. App mit derselben Test-ID verbinden und eine einfache APT-Mission annehmen.
   Der browserbasierte Tracker-EFB ist unter `http://127.0.0.1:18788/efb/v1/`
   erreichbar. Er ersetzt hier die nicht gestartete MSFS-Toolbar.
4. Start-/Zielkoordinaten und Platzhoehen aus dem Auftrag in den Teststand
   uebertragen. `Auf A bereitstellen` druecken. Das virtuelle Flugzeug ist
   eine generische C172 mit vier Standard-Payloadstationen.
5. Boarding, Pax/Cargo, Unterschrift, Verladung bestaetigen und Mission starten
   normal in App/EFB bedienen. Der Teststand gibt diese Aktionen nicht frei.
6. Nacheinander Rollen, Start, Reiseflug, Anflug, Aufsetzen und Parken ausloesen.
   Vor dem naechsten Abschnitt dessen Restzeit ablaufen lassen. Telemetrie
   wird kontinuierlich geliefert; Flugabschnitte laufen mit echten Sekunden.
7. Ankunft/Entladen/Unterschrift/Abschluss wieder in App/EFB bedienen.
   Das Befehlsprotokoll zeigt Spawn, Objekt-ID, Wege, Zuladung und Entfernung.
8. Beenden mit Ctrl+C. Die im Terminal angezeigten Testdaten bleiben erhalten.

Die lokale Ablage ist standardmaessig ein neues temporaeres Verzeichnis.
Produktive Konfigurationen werden weder importiert noch verschoben. Fuer
wiederholte Tests kann `GA_TESTSTAND_DATA_DIR` auf einen eigenen Testordner
zeigen. `GA_TESTSTAND_PORT` und `GA_TESTSTAND_TRACKER_PORT` aendern die Ports.

Nur die Bedienseite ansehen, ohne Anmeldung oder Cloud-Verbindung:

```sh
node ga-tracker-client/teststand/start.js --demo
```

**Demo fuehrt keine Mission aus.** Fuer den eigentlichen Test den normalen
Teststand-Start ohne `--demo` verwenden.

## Fehlerfaelle

Das Menue kann Spawn-/Despawn-Antworten, Payload-Lesen, Payload-Schreiben oder
Telemetrie aussetzen. Der Tracker muss dann seine echten Timeout-/Fehlerpfade
durchlaufen. Bei Rueckkehr zu Normal werden bereits verworfene Antworten
nicht nachtraeglich erfunden; die Aktion muss gegebenenfalls ueber die normale
Tracker-Recovery wiederholt werden. Simulatorpause stoppt die Flugbewegung und
meldet den Pausezustand; Missionsuhren werden nicht global beschleunigt.

Das sichtbare Protokoll ist begrenzt; `simulator-events.jsonl` im Testordner
enthaelt den gesamten Lauf. Daneben liegen die regulaeren Tracker-/Missionslogs.
Das Simulatorprotokoll enthaelt keine Pilot-PIN oder Voice-Schluessel.

## Automatisierte Pruefungen

```sh
node --test ga-tracker-client/teststand/simulator.test.js
node ga-tracker-client/teststand/tracker-integration.js
node ga-tracker-client/teststand/tracker-integration.js --mission
```

Die Integrationspruefung laedt die echten Tracker-Funktionen in einem eigenen
Prozess, ohne interaktive Anmeldung/Cloud-Start. Der Missionstest verwendet ein
benanntes synthetisches APT-Fixture, echte Intent-Validierung und den normalen
SimConnect-Lese-/Schreibpfad. Positionen fuer Flug/Landung werden automatisiert
vorgegeben; nur freigegebene Missionsaktionen werden gesendet. Audio ist in
diesem Offline-Fixture nicht konfiguriert. Dies ist kein Nachweis fuer TTS,
Browser-Playback oder den kompletten realen Feldauftrag.

Optionaler Browsertest (Playwright mit Chrome; `GA_PLAYWRIGHT_MODULE` kann auf
eine vorhandene Installation zeigen):

```sh
node ga-tracker-client/teststand/ui-selftest.js
```

## Grenzen

Kein vollstaendiger SimConnect-Protokollserver und kein Ersatz fuer die MSFS-
Physik/Asset-Engine: Es wird die Node-SimConnect-API am Tracker-Einstieg bedient.
Es werden weder reale Animationen gerendert noch Modellverfuegbarkeit, Terrain,
Kollisionen, Accu-Sim-/PA24-Spezialvariablen oder Coherent-Verhalten validiert.
Personenwege werden mit der gesendeten Geschwindigkeit interpoliert; normale
Tracker-Wartezeiten und ACKs bleiben erhalten. Fremder AI-Verkehr ist leer.
Unbekannte Schreibdefinitionen schlagen fehl, nicht modellierte Simulator-
Events stehen als `unsupported-event` im Protokoll.

Der Terminal-Teststart besitzt keinen Desktop-PC-Audioplayer; er verwendet die
bisherigen Browser-Audiomoeglichkeiten. Hoerbare PC-Ausgabe und Windows-
Ausgangswahl bleiben ein gesonderter Test mit dem Desktop-Player.

## Windows-EXE v388

`GA-Mission-Teststand-v388.exe` enthaelt Node und die benoetigten Tracker-/EFB-
Dateien. Doppelklick oeffnet die Bedienseite im Standardbrowser; im Konsolen-
fenster erfolgt die normale Test-Pilot-Anmeldung. Die EXE speichert separat
unter `%LOCALAPPDATA%\VFR Multitool\Teststand-v388` und verwendet dort bei
weiteren Starts dieselbe Testkonfiguration. Das Konsolenfenster waehrend des
Tests offen lassen. `--self-check` prueft eingebettete Assets ohne Anmeldung,
`--no-browser` unterdrueckt das automatische Browserfenster.

Reproduzierbarer Build aus dem Repository-Stamm:

```sh
node ga-tracker-client/teststand/build.js
```

Ausgabe: `ga-tracker-client/dist/GA-Mission-Teststand-v388.exe`.
Die normale Release-Tracker-EXE ist weiterhin separat und enthaelt keinen
aktivierten Teststand-Start.
