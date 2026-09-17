# Tracker v431 Alpha – EFB-Anzeigen und Bedienung

- POI-Bedingungen verwenden aktuelle Entfernung und MSL-Hoehe sowie dieselbe
  effektive Verweilzeit wie der Fortschrittsbalken. Keine alten Briefing-Messwerte.
- POI-Phasenanzeige unterscheidet Anflug, Arbeitsbereich, Rueckflug und Landung.
- PAX-Button unterstuetzt Maus/Touch-Dragging ohne Pointer-Events und speichert
  seine Position. Ziehen oeffnet nicht versehentlich das Nachrichtenfenster.
- Magenta-Linie verwendet SVG wie die Route, statt Canvas-Updates getrennt vom
  Flugzeugsymbol. Kein Eingriff in Wegpunktwahl oder Missionslogik.
- Anzeigemenue im EFB mit deckenden Farben ohne Filtereffekte. Der gemeldete
  schwarze MSFS-Popout ist lokal nicht reproduzierbar; diese Kompatibilitaets-
  massnahme muss dort bestaetigt werden.

Neue EFB-Assetrevision 43101. Tracker-Missionsregeln und Checkpoints unveraendert.

Validierung: 76 Node-Tests bestanden; Electron-UI-Pruefungen fuer Anzeigemenue,
Groessenwechsel, PAX-Dragging mit und ohne Pointer-Events sowie SVG-Linie bestanden.
Windows-x64-PE und eingebettete Tracker-Version geprueft.

Asset: VFR-Multitool-Tracker.exe
Groesse: 57798583 Bytes
SHA-256: `993886b4907519aadfc82925e00804f664275601ddab7b62086618a72ee0b6bd`
