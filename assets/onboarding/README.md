# Bilder der Onboarding-Seite

Browseraufnahmen vom 22.10.2026 aus dem lokalen Stand `6c6904a5a`, zum
Arbeitsbeginn auf dem frisch abgerufenen `origin/main` (0 voraus, 0 zurück).
Die Originaloberflächen wurden über die Browser-UI geöffnet und die relevanten
Bereiche anschließend ausgeschnitten. Keine Zugangsdaten eingetragen, kein
Profil angelegt, keine Provider-Anfrage und keine Installation ausgeführt.

- `pilot.png`: Web-App → Einstellungen → Pilot Identity & Sync; leer, offline.
- `ki.png`: Web-App → Einstellungen → KI-Dispatcher, Gemini ausgewählt, kein Key.
- `crew.png`: Web-App → Einstellungen → Crew Board; leer, nicht angemeldet.
- `konto.png`: Tracker → Konto mit leeren Feldern; sichtbarer Pilotname ist der originale Platzhalter.
- `voice.png`: Tracker → Audio, Ausgabe, Provider und leeres Voice-Key-Feld.
- `autostart.png`: Tracker → Autostart; deaktiviert, keine Windows-Anbindung.
- `funk.png`: Tracker → Audio → Funk-Pause; deaktiviert.

Die Tracker-Oberfläche wurde mit ihren Originaldateien im Browser dargestellt.
Sie ist hier nicht mit Electron, Windows oder einem Simulator verbunden.
Die Bilder zeigen die Bedienelemente, keinen erfolgreichen Verbindungszustand.

`../../onboarding.html` ist eine eigenständige Anleitung, keine Änderung am
integrierten App-Tutorial. Nur Checklistenzustände und die zuletzt geöffnete
Schrittnummer werden lokal im eigenen Onboarding-Speicherschlüssel gespeichert;
es werden keine Zugangsdaten abgefragt oder App-Einstellungen verändert.

Die exportierte Einzeldatei `../../exports/VFR-Multitool-Onboarding.html`
enthält Bilder, Gestaltung und Bedienung vollständig eingebettet.
Erzeugung aller verknüpften Infoseiten: `python3 tools/build-user-guide.py`, danach
`python3 tools/export-info-pages.py`. Der bisherige Befehl
`python3 tools/export-onboarding-page.py` exportiert weiterhin nur Onboarding.
Der Anleitungslink im Export verweist auf die danebenliegende aktuelle Datei
`VFR-Multitool-Anleitung.html`. Für die Querverweise die drei exportierten
HTML-Dateien zusammen weitergeben. App- und Rechtslinks führen zur Origin-/Alpha-App.

Quellen zur API-Key-Einrichtung, am 22.10.2026 geöffnet und geprüft:
- https://ai.google.dev/gemini-api/docs/api-key
- https://developers.openai.com/api/docs/quickstart
- https://developers.openai.com/api/docs/pricing

App-Klickpfade und Verhalten wurden zusätzlich gegen `index.html`,
`sync.js` (triggerLoginFlow), `ga-tracker-client/desktop/ui/index.html`,
`ga-tracker-client/desktop/ui/renderer.js`,
`ga-tracker-client/desktop/lib/auth-client.js`, `README.md` und
`ga-tracker-client/desktop/README.md` geprüft.
