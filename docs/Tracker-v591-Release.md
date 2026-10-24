# Tracker v591 Alpha / Web v2208 – EFB merkt sich NAVCOM-Modus und Media Player

Testerbericht: Im EFB gingen die NAVCOM-Wahl (Gerät 1 aktiv / Auswahl / Aus) und der Schalter
„Mediensteuerung“ bei jedem Neustart verloren. In der Web-App blieben beide erhalten.

## Ursachen

- **NAVCOM:** `navcom-preferences-client.js` legte für jede Anfrage einen `AbortController` an.
  Die Simulator-Webansicht (Coherent) hat diesen teilweise nicht (siehe auch
  `tracker-efb-profile-bridge.js`). Die Anfrage scheiterte vor dem Absenden, der Fehler wurde
  verschluckt; der Tracker erhielt die Wahl nie. Der Speicher der Sim-Webansicht übersteht keinen
  Neustart, also war der Modus danach weg. Nachgestellt ohne `AbortController`: alte Fassung
  0 Anfragen an den Tracker, neue Fassung speichert den Modus.
- **Media Player:** Ein/Aus und Skin lagen im EFB nur im Speicher der Webansicht, nie im Tracker.

## Änderungen

- `navcom-preferences-client.js` (Web und EFB): `AbortController` nur, wenn vorhanden. Die
  15-s-Zeitgrenze gilt jetzt auch ohne ihn, damit eine hängende Anfrage den Abgleich nicht
  dauerhaft blockiert.
- `tracker-efb-display-settings.js`: `mediaEnabled` (bool) und `mediaSkin`
  (`winamp`/`ipod`/`watch`) als erlaubte Werte in `efbDisplay.ui` der Tracker-Config.
- `efb-media-source/media-player-client.js`: meldet Änderungen über `gaPersistMediaSetting`,
  übernimmt gespeicherte Werte über `gaMediaPlayerClient.applyPreferences`.
- `tracker-efb-kartentisch-host.js`: leitet die Werte wie Kartenfenster und Uhr-Skin weiter
  (Startabgleich ergänzt nur fehlende Werte, Statusstrom wendet sie an).
- EFB-Asset-Sync übernimmt zusätzlich die seit 471a09dda ausstehende `styles.css`
  (entferntes NAVCOM-Rack-V2-Experiment, Klasse wird nirgends mehr gesetzt).

Nach dem Update den Media Player einmal neu einschalten; danach bleibt die Wahl erhalten.

Tracker v591, Host-Assetrevision 59101, Web-Cache v2208. EFB-/Toolbar-Community-Paket und
Desktop-Installer unverändert. Nur Alpha-Runtime umstellen, Stable unverändert.

## Prüfung

- Neu: Neustartfall in `tracker-efb-display-settings.test.js` (gespeicherte Wahl schlägt
  Startwerte einer frischen Ansicht, ungültige Werte abgelehnt).
- Gesamtsuite `ga-tracker-client/*.test.js`: 1482 Tests, 1445 bestanden, 35 Fehlschläge –
  dieselben wie auf v590-Stand (dort 37: zusätzlich Asset-Sync und Web-Client, jetzt grün).
- Windows-x64 mit pkg 6.18.1 / Node18, ARM-Cross-Build `--no-bytecode --public --public-packages '*'`.
  PE32+ x86-64; v591, Assetrevision 59101 und beide Fixes eingebettet geprüft.
- Nicht gelaufen: `tools/navcom-cloud-browser-selftest.mjs` (Playwright lokal nicht installiert).

EXE: 174346841 Bytes; SHA-256 `d04db1a94041b33ac61d6335f1062d4aae64340fa780d7784cd0308f1dcde963`.

## Im Feld prüfen

- EFB: NAVCOM auf „Auswahl“ bzw. „Aus“ stellen, MSFS neu starten → Modus bleibt.
- EFB: Mediensteuerung an, Skin wählen, MSFS neu starten → beides bleibt.
- Web-App: NAVCOM-Wahl weiterhin geräteübergreifend.
