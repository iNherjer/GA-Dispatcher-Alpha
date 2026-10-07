# Tracker v490 Alpha: UI-Lifecycle und Anzeige-Persistenz

Nutzer hat am 7. Oktober 2026 den Alpha-Rollout beauftragt. Der geprüfte
UI-Kandidat 931764f4f wird mit aktuellem Alpha f80f63cdb integriert; Bush-,
Dispatch-, Wetter- und Quota-Änderungen aus v489 bleiben erhalten.

Tracker v490, Webassets 49001, Webcache v1955. Windows-EXE: 173642788 Bytes,
SHA-256 2caae1d6c2a87f043ec3260440536fd20047b302e66b2b7b96a6bf104120ba86.
13 relevante eingebettete Quellmodule bytegleich geprüft. ARM-Host baut
Windows-x64 mit pkg node18 ohne Bytecode, public/public-packages wie bisher.

65 UI-/HTTP-Tests und Interface-Regressionsprüfung nach Integration bestanden.
155 Browserfälle auf ursprünglichem UI-Kandidaten bestanden; 33 Anzeige-/Profil-
Fälle nach Integration erneut bestanden. Weitere Lifecycle-/Paketprüfungen
werden nach Abschluss protokolliert. Keine Screenshots.

Anzeigeoptionen, Profilmodus und explizite ALT/V/S-Werte werden validiert im
Tracker gespeichert, revisionsgeschützt über vorhandene Statuspolls verteilt.
Kein Config-Dateilesen pro Statuspoll. E6B, Zeichnen und Telemetrie reagieren
gezielt auf Layout-/Transportänderungen. Profilbuttons lösen Neuzeichnung aus;
native Prompts werden im EFB durch HTML-Zahleneingabe ersetzt. Neue Routen
respektieren ausgeblendete Profile. Resize-Listener werden nur einmal gebunden.
HDG-Y-Achse funktioniert ohne Route; VR-Nachrichten erhalten bekannte Surface.

Native Toolbar-Recovery liegt in Panel.js und benötigt frischen offiziellen
SDK-Bau als Paket 0.4.23. Der Windows-SDK-Host ist derzeit nicht erreichbar;
aktiver EFB-Alpha-Kanal 0.4.21 bleibt bis gebautem/verifiziertem Paket erhalten.
SDK 0.4.22 ist ein bereits getaggter, inaktiver Wetterkandidat und wird nicht
ersetzt. Keine selbst erzeugten manifest/layout-Dateien als SDK-Bau ausgeben.
Stable-Kanäle bleiben unverändert. Reale Windows/MSFS/VR-Abnahme offen.
