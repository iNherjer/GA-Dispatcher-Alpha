# Tracker v424 Alpha – Cargo nach Original-App-Modell

Die sichtbare Cargo-Objektsteuerung wird jetzt aus dem Originalcode der
Standalone-App extrahiert: Queue, Flush, ACK und Cancel. Quellgleichheit wird
beim Build geprueft. Pro Objekt wird der neueste Zielzustand gebuendelt, ohne
auf den vorherigen Simulator-ACK zu warten. Der fachliche Manifest-Kern war
bereits gemeinsam; seine Regeln bleiben die Referenz.

Nach erfolgreichem Cargo-Commit startet die Objektsteuerung unmittelbar, ohne
hinter dem allgemeinen Effekt-Drain zu warten. Gemeinsame Dispatch-Reservierung
verhindert doppelte Ausfuehrung. Der bisherige Drain uebernimmt weiterhin Recovery
und Retry. Payload und Voice bleiben unabhaengig. Keine neue zweite Authority.

114 Tests erfolgreich: Manifest-/Adapter-/Runtime-/Payload-Regressionen,
Originalvergleich mit 100 schnellen Klicks, mehreren Items, spaeten ACKs und
Cancel; haengender Hintergrundauftrag blockiert Cargo nicht; verlorener ACK
bleibt wiederholbar. Originalreferenz ist eingefroren und wird nicht generiert.

Auch die alte App hat 180 ms Debounce; die vorherige Zuschreibung dieses Werts
als neuen Tracker-Overhead war unzutreffend. Diese Pause bleibt originalgetreu.
Die Authority-Speicherung vor Bestaetigung bleibt bestehen. Deshalb ist noch
keine Latenzgleichheit unter Windows/MSFS nachgewiesen. Neue Marker trennen
Commit, direkten Start und reale Queuewartezeit.

Windows-x64-PE mit pkg 6.18.1/Node18 gebaut. Nur Alpha. EFB-Package und Stable
unveraendert. Feldtest: Tracker v424, experimentelle Missionsausfuehrung an,
Laden/Entladen einschliesslich schneller Wechsel und mehrere Items.

Asset: `VFR-Multitool-Tracker.exe`  
Groesse: 57753182 Bytes  
SHA-256: `9f5b2b6994002d63b2c4eb9ff081d736f6767665effdea0b364d2b24eac11476`
