# Tracker v568 Alpha – Flugplanbanner, Verladesperre, EFB-Kontextpopup

Flugplanungs-Banner auf der Weltkarte ist mit ✕ ausblendbar. Solange es
ausgeblendet ist, holt der Toolbar-Knopf „🗺️ Flugplan“ es zurück, um geänderte
Routen erneut an die Simulator-Flugplanung zu senden. Knopf und ✕ existieren nur
im Weltkarten-Planungszustand, nie im geladenen Cockpit.

Verlade-Manager ist im MSFS-Hauptmenü, auf der Weltkarte, im Hangar und bei
Ladebildschirmen gesperrt (Tracker-`startReadiness`: worldReady false mit
Grund simulator_not_ready/cockpit_not_loaded/position_not_ready, oder veraltete
Daten ohne Live-Kameraansicht). Gemeinsame Regel `cargoWorldAvailable` in
`mission-control-ui-core.js` für Web-Toolbar, EFB-Toolbar und Missionspanel;
zusätzlich Sperre im EFB-Verlade-Manager selbst. Ohne Readiness-Daten bleibt das
bisherige Verhalten. Pausenmenü im Flug zählt als Menü.

EFB „Was ist hier?“: Popup bis 344 px (vorher 320), Höhenband 104 px (vorher
72), Textbereich entsprechend schmaler. Wolken im EFB Coherent-tauglich
vereinfacht: ohne filter/blur, elliptische Radien, isolation und Animation;
hell, halbtransparent, hinter Luftraumbändern, Skala und Beschriftung;
Gewitter dunkler. Webapp-Wolken unverändert.

Tests: Tracker-/EFB-Tests, Missions-UI-Core (neuer Readiness-Fall) und
Electron-Anzeigemenü-Selbsttest bestanden. EFB-Kartentisch lokal mit simuliertem
Weltkarten-Zustand, echten Open-Meteo-Daten und FIS/TMA-D-Band geprüft. Reale
MSFS-/Coherent-/VR-Abnahme (insbesondere Wolkendarstellung) offen.

Windows-x64-EXE mit pkg/Node18 ohne Bytecode aus sauberem Release-Worktree
gebaut: 174088744 Bytes, SHA-256
`24655e12e5e12f2da83316eb7730273fe800975984eb68e7d7b00fe15769f420`.
Assetrevision 56801, Web-Cache v2160. Release v568 veröffentlicht; öffentlicher
EXE-Download größen- und SHA-256-gleich verifiziert. Alpha aktiviert, Stable
unverändert. Kein Community-Paket- oder Desktop-Update nötig. Quellstand `4e054926f`.
