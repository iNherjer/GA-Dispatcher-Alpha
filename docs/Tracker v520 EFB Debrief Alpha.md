# Tracker v520 Alpha: EFB-Debrief

Das EFB zeigt den abgeschlossenen Tracker-Lauf mit derselben Debrief-Oberfläche
wie die Web-App. „Debrief schließen & Mission aufräumen“ bestätigt den
terminalen Lauf über die authentifizierte Cockpit-Sitzung. Der Abschlussmarker
wird vor ACK gespeichert und in App und EFB übernommen; neue Läufe werden
vor altem Cleanup geschützt. Ohne Verbindung übernimmt die App den Marker
beim nächsten Verbinden. PDF-Export bleibt in der App verfügbar.

Tracker v520, EFB-Hostassets 52001, Web-App-Cache v2021.
Das installierte EFB-Community-Paket benötigt kein neues Archiv.

Validierung: 154 Node-Tests, App-/EFB-Interface-Selftest, Electron-UI-Test in
900×640, 440×894 und 894×440 sowie gepackter Mission-Worker-Smoke-Test mit
Worker-Exit 0 bestanden. Windows-EXE als PE32+ x86-64 mit pkg 6.18.1 /
Node 18.20.8 ohne architekturabhängigen Bytecode gebaut. Ein echter
Windows-/MSFS-Feldtest steht noch aus.

Release-Asset: `VFR-Multitool-Tracker.exe`, 173321881 Bytes,
SHA-256 `936fed9fc471d74ef54e6782f21589bc6d79e9d8fa7a5d4fccf49f5dd97e22aa`.
Alpha-Aktivierung erfolgt nach veröffentlichtem und verifiziertem Download.
Stable und Beta bleiben auf ihrem bisherigen Stand.
