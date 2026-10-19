# Tracker v570 Alpha / Web v2163 – Win95-Oberflächen

Win95 verwendet die allgemeinen Einstellungen wieder als klassisches Fenster
mit Titelzeile, Minimize/Close, Scrollbereich und Checkboxen. Die Lederrolle
bleibt bei den anderen Presets. Anzeige-/Audiomenüs haben eine konsistente
Win95-Palette, EFB-Skin-/Uhrauswahlen einen sichtbaren Auswahlzustand.

Player und Stoppuhr behalten ihr eigenes Design: ga-skin-control grenzt deren
Controls von globalen Formularregeln ab, einschließlich dynamischer Menüs.
Lautstärkeregler und Launcher bleiben Teil des gewählten Skins. Symbol-Fallbacks
ergänzt; Pixeldisplay zeichnet Umlaute, Großumlaute, ß und · statt Ersatzzeichen.

Tracker v570, Host-Assetrevision 57001, Web-Cache v2163. Bestehendes EFB-/Toolbar-
Community-Paket und Desktop-Installer unverändert. Nur Alpha-Runtime umstellen.

Validierung: sechs Win95-Browserfälle (Web/EFB/Toolbar × 440/1000 px),
Einstellungsfenster öffnen/minimieren/schließen/scrollen, Menüpalette,
Skin-Stilvergleich, Rundlauncher, Stoppuhr und echte Bitmapvergleiche für
Sonderzeichen einschließlich NFC/NFD. iPod-/Winamp-/Watch-Regressionen und
vier Coherent-Capability-Fälle bestanden; 35 relevante Node-Tests nach
Versionsanpassung erneut bestanden. Asset-Sync grün. Echte Coherent-/MSFS-
und Windows-Ausführung bleiben Feldabnahme; Browsertests ersetzen sie nicht.

Windows-x64 mit pkg 6.18.1 / Node18 gebaut, dokumentierter ARM-Cross-Build
`--no-bytecode --public --public-packages '*'`. PE-x64, v570, Assetrevision
57001 und exakte eingebettete Player-/Style-/Utility-/Host-Dateien geprüft.

EXE: 174141891 Bytes; SHA-256 `05c997eeab98e622b793149ad92743e287be84f0fe4236215d26e5295c9b9ba0`.

Release-Upload verifiziert und EXE öffentlich erneut heruntergeladen: Größe
und SHA-256 stimmen exakt überein. Alpha wird auf v570 aktiviert.
