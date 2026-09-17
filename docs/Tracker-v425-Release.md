# Tracker v425 Alpha – eigener Missionsprozess

Die Missionsausfuehrung bekommt einen eigenen lokalen Prozess. Authority,
Runtime, Cargoqueue und persistente Missionsverwaltung blockieren damit nicht
mehr unmittelbar die Hauptschleife fuer SimConnect und EFB-HTTP. Die bestehende
Missionslogik und die originale Cargoqueue bleiben erhalten.

Der Tracker startet den zweiten Prozess selbst aus derselben EXE. Einzelne
Auftraege und Ergebnisse laufen ueber lokales IPC, Telemetrierueckstau wird
begrenzt. Die UI erhaelt weiterhin den bestaetigten Missionszustand. Alte
Simulatorverbindungen und spaete Antworten sind ueber Verbindungsgenerationen
getrennt. Ein Worker-Abbruch fuehrt zu einem Missionsfehler, ohne den lokalen
HTTP-Server mitzunehmen. Keine automatische Wiederholung unbestaetigter
Simulatorbefehle; Recovery nach Tracker-Neustart bleibt erhalten.

206 Tests bestanden: Cargo-/Runtime-/Payload-/Authority-Regression,
Original-App-Queuevergleich und echte Prozess-, Recovery- und HTTP-Tests.
Ein vollstaendig angehaltener Missionsprozess blockiert im Test weder lokale
EFB-Anfragen noch Hauptprozess-Timer. Windows-/MSFS-Latenz ist damit noch nicht
nachgewiesen. Persistenz und Berechnungen koennen die Mission selbst weiterhin
verzoegern; neue Prozessmarker machen dies getrennt sichtbar.

Feldtest: v425 im Alpha-Kanal, experimentelle Missionsausfuehrung an. Reset,
einzelnes Laden/Entladen, danach schnelle Wechsel und mehrere Items pruefen.
Klick -> UI und UI -> Objekt bitte getrennt beobachten. Prozessstart/PIDs,
Intent-Rundlauf und Worker-Bearbeitungszeit stehen im Debuglog.

Windows-x64-PE, pkg 6.18.1/Node18.

Asset: `VFR-Multitool-Tracker.exe`

Groesse: 57772325 Bytes

SHA-256: `0a1714521ab4b6d47deeaa07307728b370f3d9dce8cf612ef1e02b2763e15d26`
