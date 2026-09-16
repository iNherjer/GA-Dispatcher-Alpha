# Tracker v417 Alpha

## Gemeinsame PAX-Abfragen

Wohlbefinden, Ladung und Wetter laufen bei Tracker-Autoritaet ueber revisionsgebundene
Intents und die vorhandene zentrale Voice-Warteschlange. App und EFB steuern denselben
Ausfuehrer. `mission-pax-query-core.js` wird aus den originalen manuellen Funktionen
in `passenger-voice.js` generiert; `--check` verhindert abweichende Texte.

Verfuegbarkeit bleibt wie Standalone: Wohlbefinden bei APT mit PAX ohne Cargo-Fokus,
Ladung bei APT mit Cargo-Fokus, Wetter bei markantem Live-Wetter und PAX/Cargo-Fokus.
POI behaelt Status/Orientierung und erhaelt die passende Wetterabfrage. Messwerte
stammen aus dem Tracker-Komfortzustand, fehlende Pflichtladung aus seinem Manifest.
Ein offener manueller Sprachauftrag sperrt weitere solche Abfragen. Der App-Pfad
bleibt ohne Tracker-Autoritaet erhalten.

## APT-Privatmissionen

Die zusaetzliche Heimreise-Erzaehlung war nur im App-Recorder angeschlossen.
Tracker verwendet nun Original-Ausloeser aus `mission-runtime-core.js` und
Original-Sprachfunktion aus `passenger-voice.js`: 60 Sekunden Flugphase, mindestens
500 ft AGL, keine Ankunft/Abschlussansage. Pause/Menue setzen die Wartephase zurueck.
Der App-Ausloeser schweigt bei Tracker-Autoritaet. Persistierter Zustand und bereits
angenommene Effekte verhindern Wiederholung nach Restart. Vier bestaetigt ausgegebene
Texte (je maximal 600 Zeichen) liefern Kontinuitaet fuer folgende Heimreise-Beitraege.
Dies ist keine Aenderung der privaten Missionsklassifikation oder Abschlussregeln.

Automatische Komfort-/Wetterreaktionen waren bereits angeschlossen. Sie bleiben
situationsabhaengig (Belastung, Empfindlichkeit, Abflugabstand, Sperrzeiten), keine
periodische Unterhaltung. Die neue Heimreise-Ansage kostet maximal einen weiteren
Text-/TTS-Vorgang pro Lauf; manuelle Abfragen jeweils einen bei Bedienung.
Keine neuen regelmaessigen Cloud-Uploads oder Worker-Writes; lokale Runtime-Checkpoints
und vorhandene Effektpersistenz werden genutzt.

## Offene Integrationsfolge

Autonome Folgeangebote sind noch nicht implementiert: `followUpRequests` werden
synchronisiert, die Angebotserzeugung haengt aber weiterhin am App-Abschluss.
Private Outing benoetigt weiterhin bestaetigte gemessene Flug-/Zielevidenz;
Entwurf, fehlgeschlagener Flug und Umleitung duerfen kein normales Rueckflugangebot
erzeugen. Naechster Baustein: originalgetreuer Abschluss-/Follow-up-Kern mit dauerhaftem
Postausgang, Deduplizierung und konfliktfestem Cloud-Merge. Danach Sightseeing samt
Wissenskontext und manueller Wissensabfrage; Gate unveraendert.

## Nachweise

299 Missions-/Voice-/Private-Return-Tests, 105 EFB-Tests erfolgreich. Zusaetzlicher
Runtime-Test durchlaeuft Boarding/Start, Heimreise-Trigger, Pause, Runtime-Neustart
und manuelle PAX-Abfrage. Generatoren gegen Originalfunktionen geprueft.
In-Sim-Audio-/Bedientest steht aus.

Runtime v417, EFB-Assets 41701, App-Cache v1793. Desktop 1.6.11 und EFB 0.4.14 bleiben kompatibel.
