Tracker v484 Alpha – Popout-/Toolbar-Layout bei 2D-/VR-Wechsel

Auf dem bisherigen öffentlichen Alpha-Stand v483 aufgebaut. SDK-Paket bleibt 0.4.20.

Popout und Toolbar berechnen Fenster, offene Menüs und Seitenmenüs nach dem Wechsel aus der logischen UI-Größe. Profil-Eingaben bleiben scrollbar; Zahnrad und RTE bleiben erreichbar. Die Standardposition des PAX-Knopfs verdeckt diese Aktionen nicht mehr. Telemetrieboxen werden ohne Überlappung angeordnet, Zeichenknopf und Höhenprofil passen in den verfügbaren Bereich. Beim Wiederanheften kehren originale 3D-EFB-Knoten und temporäre Layoutstile zurück.

Benutzerwahl 90–300 %, getrennte 2D-/VR-Profile und VR-Grundfaktor 1.5 bleiben erhalten. Keine Änderung an Missionen, Ports oder SDK-Fensteraktionen.

Vergleichstest: v483 und v484 mit derselben Mission, Fenstergröße und gespeicherten 2D-/VR-Skalierung testen. Popout sowie Toolbar mehrmals 2D → VR → 2D wechseln; Menü offen/geschlossen, Profilaktionen, Höhenband und Rückkehr zum 3D-EFB vergleichen.

Validierung: 33 Node-Tests, 60 Browser-Layoutfälle, 20 Fälle ohne ResizeObserver, Schrift-/Drag-/Canvas-Regressionstest und Windows-EXE-Assetkontrolle. Reales MSFS-/Coherent-/VR-Feldtesting folgt.
