# Tracker v434 Alpha – EFB-Kartenbedienung und Bewegungsdiagnose

- Zoomanimation und Kachelnachladen wie Desktop-Standalone; blockierende
  EFB-CSS-Uebergangsregeln entfernt. Aero bleibt native Zoom 12 / Kartenzoom 18.
- Routenklickflaeche auf SVG statt Canvas. Wegpunkte liegen darueber und sind
  ueber ihre volle 34px-Flaeche anklickbar; sichtbare Linie nicht doppelt interaktiv.
- Wetterwerte im schmalen Flugplatzwidget untereinander, ohne ueberlappende Spalten.
- Sparsame 10s-Diagnose fuer ausbleibende Komfort-/Schadensreaktionen: empfangene
  G-/Bank-/Sinkwerte, Pause/Menu und im Missionspaket uebernommener Slew-Schutz.
  Maxima kumulativ seit Prozessstart; keine geaenderten Bewertungsregeln.

50 Missions-/Runtime-/Bewegungspuffer-Tests bestanden. Lokale Electron-Tests fuer
Popup, Wetterwidget, Route, PAX und Klick am Rand eines Wegpunkts bestanden.
EFB-Assetrevision 43401. MSFS-Zoomverhalten und Belastungsauswertung im Feld pruefen.

34 weitere Webclient-/Kachel-/Karten-Tests bestanden. Windows-x64-PE geprueft.

Asset: VFR-Multitool-Tracker.exe
Groesse: 57801657 Bytes
SHA-256: `56976f316ccc8deb25abb2efb40d9170ada6de368c4dee289dfe37d892e99f37`
