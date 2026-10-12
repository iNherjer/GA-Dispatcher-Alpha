# NAVCOM: Frequenzen und Squawks übernehmen

Alpha v522, 12.10.2026. Grundlage: aktuelles origin/main v521 (`dff307919`).
Ausschließlich NAVCOM auf diese Basis übertragen; keine anderen lokalen Änderungen.

## Bedienung und Anzeigen

Anzeige-Menü: **NAVCOM: AUS / Gerät 1 aktiv / Auswahl**, standardmäßig AUS.
Pro Browser/EFB unter `ga-navcom-mode-v1` gespeichert. Direkt: COM1, NAV1,
ADF1 bzw. Transpondercode. Auswahl: Gerät 1/2 → Aktiv/Standby, mit identischen
Zeilenpositionen. Squawk: Transponder → Code setzen. Design und native EFB-
Skalierung berücksichtigt. Rendern/Poll/Missionsstart senden keinen Set-Befehl.

Angebunden: Flugplatzlisten/Start/Ziel/Wetter-Popups (`airport-radio.js`,
`map-airport-popup.js`), kurze/ausführliche Karten-Punktfenster/Navaids
(`map-single-click.js`), Luftraum-/Flugplatz-/Navaid-Punktkontext
(`map-context-popup.js`), Warnbanner/TMZ-Squawks
(`navigation-warning-presentation.js`), Seitenmenü/Luftraum/Radio/Funkfeuer/
Platzdetail/Nearest/Zielplatzdaten im Next-WPT-Fenster (`checklists.js`),
App-Luftraumliste/KLN-Frequenzseiten (`app.js`) sowie aktuelle Frequenz,
Route-FREQ-Leiste/Next Waypoint (`sync.js`, Tracker-EFB-Host).

Briefing-Fließtext, Exporte, feste Kartenbeschriftungen und TACAN ausgenommen.
VOR-Anteil von VORTAC bleibt NAV; reine DME-/TACAN-Kanäle bleiben Anzeigen.
Nur explizite Frequenzfelder werden markiert, keine globale Zahlensuche im DOM.
Radio-Typ bleibt beim Snapping als begrenzte UI-Metadaten erhalten.

## Transport und Bestätigung

Additive Capability `radio.tuning.v1`, keine erhöhte App-Mindestversion.
App: PIN-authentifizierte `radio_tuning_request` / `radio_tuning_ack`.
EFB/Toolbar: bestehende Cockpit-Sitzung, Tool-Intent `radio_tune`.
Payload `{kind: COM|NAV|ADF|XPDR, value, index: 1|2, slot: active|standby}`.
XPDR erlaubt nur Index 1/active und vier Ziffern aus 0–7. Deduplizierung,
Konfliktprüfung, Rate-Limit und begrenzte Laufzeiten auf beiden Wegen.

Tracker validiert erneut, sendet genau ein Set-Event und liest höchstens
dreimal begrenzt die entsprechende SimVar. Nur passender Rücklesewert ergibt
`confirmed:true`. Kein automatischer Schreibretry, kein konkurrierender Set-
Vorgang. COM/NAV in Hz, ADF BCD32-Hz, Squawk BCO16 mit führenden Nullen.
Keine Änderung von Spacing, Senderwahl, OBS, Transpondermodus oder IDENT.
Gerätebestand und Add-on-eigene Avionik werden nicht pauschal vorausgesetzt;
fehlende Bestätigung bleibt sichtbar. Reale MSFS-/8,33-kHz-Nachtests offen.
SDK: https://docs.flightsimulator.com/msfs2024/html/6_Programming_APIs/Key_Events/Aircraft_Radio_Navigation_Events.htm

## Nachweise und Build

92 NAVCOM-/Cockpit-/Karten-/EFB-/Navigationsregressionen und 89 Trainings-/
Anzeige-/APT-Fälle bestanden. Drei Training-Generatorchecks sowie vorhandene
Tracker-Interface-Regressionen bestanden. NAVCOM-UI-Test: echte lokale EFB-
Seite, fünf Designs, AUS/Direkt/Auswahl, fixe Zeilen, COM/NAV/ADF/XPDR,
Banner-Erhalt, Telemetrie/Next-WPT/Popups und 50–300 % Skalierung; zusätzlich
ohne String.padStart/NodeList.forEach. Nearest-/Zielplatztest für Quell- und
kompilierte Skripte, mehrere Viewports und tatsächlichen COM1-Aktiv-Klick.
Voller Asset-Sync/Cargo-Queue-Check bestanden. Gepackter ARM64-Missionsprozess:
`MISSION_PACKAGED_PROCESS_SMOKE_OK`, Worker-Exit 0.

Windows-x64: pkg 6.18.1, Node 18, `--no-bytecode --public --public-packages '*'`.
Intel-Fabricator auf diesem ARM-Mac nicht ausführbar; alle Quellen gepackt.
PE-AMD64 und exakter Inhalt der neuen Radio-Module/EFB-Assets sowie bestehenden
Trainings-UI und Styles geprüft. Babel-Helper 7.29.7; unverändertes Navigation-
Warnings-Asset bytegleich zu Origin statt einer reinen Helper-Regenerierung.

Der ältere Font-UI-Selftest erwartet fälschlich eine 90-%-Untergrenze (Origin
unterstützt 50 %). Eine temporäre Testkopie prüfte weitere Font-/DOM-Pfade bis
zu einer weiteren Canvas-Größen-Annahme. Skalierungs-/Profil-Code und solche
Testannahmen wurden nicht verändert. Neues Auswahlfenster separat skaliert geprüft.

Web-Cache v2025, EFB-Assets 52201. Kein neues natives Community-Paket.
Stable-Kanal unverändert. Windows-/MSFS-Gerätenachtest nach Alpha-Rollout offen.
