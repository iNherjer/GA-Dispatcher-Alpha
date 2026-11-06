# Tracker v618 Alpha / Web v2350 – Eigenes Flugzeug-Icon wählbar

## Änderungen

- **Icon-Auswahl für das eigene Flugzeug** im Karten-Menü (Anzeige → Flugzeug Icon): Klassik
  (bisherige Zeichnung), 1-mot, 2-mot, Jet, Heavy, Heli. Farbe und Größe wie bisher.
  Gespeichert in `ga_plane_icon_kind` (`ga_plane_color`, `ga_plane_size` unverändert).
- **Icon pro Flugzeug-Profil** (Preset-Editor → Karten-Icon): Schalter „Eigenes Icon verwenden“
  mit Icon, Farbe, Größe (Preset-Feld `icon {custom, kind, color, size}`, Cloud-Sync mit den
  Presets). Es gilt das im Hauptmenü gewählte Profil (`selectedAC`).
  - Schalter an: Profil-Icon gilt; Änderungen im Karten-Menü werden im Profil gespeichert.
  - Schalter aus: globales Icon; Profilwerte bleiben erhalten.
  - Hinweis im Karten-Menü: „Globales Icon“ oder „Profil-Icon · <Name>“.
- **Höhenband:** gewählte Klasse als Seitenansicht in eigener Farbe/Größe.
- **EFB:** globale Auswahl wirkt auf Karte und Höhenband (keine Profile im EFB).
  `EFB_WEB_ASSET_REVISION` 61801.
- Code: `aircraftHtml(kind)` in `map-live-presentation.js`, Logik in `map-display-controls.js`
  (`getOwnPlaneIcon`, `applyOwnPlaneIcon`), Preset-Anbindung in `app.js`
  (`gaActivePlaneIconProfile`, `gaSavePlaneIconProfile`), Marker-Tausch `refreshOwnPlaneIcon`
  in `sync.js` und `tracker-efb-kartentisch-host.js`.

## Verträglichkeit

- Ohne Auswahl bleibt alles wie bisher (Klassik, globale Farbe/Größe).
- Ältere App-Stände ignorieren das Preset-Feld `icon`; neue lesen Presets ohne `icon` als „aus“.

## Geprüft

- Browser: globale Auswahl, Profil-Icon an/aus, Menü ändert bei Profil-Icon nur das Profil,
  Editor speichert, Marker wechselt sofort und behält die Drehung.
- Tests: Web 205/205, EFB 147/147, Tracker 1540/1545 (2 übersprungen; 3 zeitabhängige Missions-Integrationstests im Gesamtlauf rot, einzeln grün).
- Im MSFS-EFB noch nicht geprüft.

Stable bleibt unverändert (v605).

## Aktivierung

_wird nach Build und Download-Prüfung ergänzt_
