# Tracker v569 Alpha / Web v2162 – Watch-Uhr

Watch mit analogem Zifferblatt, regionaler Uhrzeit, Tages-/Nachtring,
Wettertemperatur und Luftdruck. Anzeige → Zeit → Uhr wählt klassische Stoppuhr
oder A Watch, unabhängig vom Musik-Skin. Gemeinsame Stoppuhr/Timer mit der
bestehenden dedizierten Uhr; Vollbild-Zeitmessung, Sekunden per Krone,
flüssige Zehntelsekunden und 700-ms-Zurück-Halten zum Schließen.
Watch-Buttons behalten ihr Design auch unter Win95.

Tracker v569, EFB-Assetrevision 56901, Web-Cache v2162. Bestehendes SDK-
Community-Paket und Desktop-Installer unverändert. Nur Tracker-Alpha umstellen.

Validierung: 45 Node-Tests und 2 lokale Medienprotokolltests; Watch-/Webapp-,
Uhrauswahl-, EFB-/Toolbar-Medien- und eingeschränkte CSS/Input-Regressionen
bestanden. Vier Watch-Fälle mit 440/1000 px, 100/150 % und vier Themes;
SVG ohne Pixel-Readback, Legacy-Maus/Touch, gemeinsame Timer, Longpress-Wege.
Echte MSFS-/Coherent-/VR-Feldabnahme bleibt offen; Browsertests ersetzen sie nicht.

Windows-x64 mit pkg 6.18.1 / Node18 gebaut, dokumentierter ARM-Cross-Build ohne
Bytecode (`--no-bytecode --public --public-packages '*'`). PE-x64, v569 und
exakte eingebettete Watch-/Uhr-/Utility-/SunCalc-Assets geprüft; Asset-Sync grün.
Keine Windows-Ausführung auf diesem Mac.

EXE: 174136913 Bytes; SHA-256 `2e1509369efea7258fde5e368419661c05751c7862b74b7a33839f097bc83a33`.

Release-Asset öffentlich erneut heruntergeladen: Größe und SHA-256 stimmen
exakt überein. Alpha wird auf v569 aktiviert; Aktivierungs-Push mit Cache v2162.
