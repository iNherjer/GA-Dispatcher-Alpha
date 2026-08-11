# Tracker EFB Web Assets

Dieses Verzeichnis ist das versionierte Windows-`pkg`-Bundle fuer den
tracker-gehosteten Kartentisch. Die Dateien werden nicht manuell gepflegt.

Vor jedem Tracker-Build fuehrt npm automatisch
`node sync-efb-web-assets.js` aus. Das Skript extrahiert den Kartentisch-DOM
aus `../index.html` und spiegelt nur die explizit freigegebenen App-Styles,
Leaflet-, Werkzeug-, Flugzeugmarker- und E6B-Dateien in dieses Verzeichnis.

Der EFB-Hostadapter liegt ausserhalb des generierten Bundles in
`tracker-efb-kartentisch-host.js` und
`tracker-efb-kartentisch-host.css`.
