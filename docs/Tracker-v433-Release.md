# Tracker v433 Alpha – Flugplatzwidget und Direct To

Die kompakte Pisten-/Windrose im EFB behaelt ihre quadratische Flaeche auch ohne
CSS-aspect-ratio-Unterstuetzung. Absolute Pisten- und SVG-Layer kollabieren nicht
mehr auf einen schmalen Streifen.

Der vorhandene Direct-To-Button ist jetzt mit seiner fehlenden EFB-Funktion
verbunden. Nach Bestaetigung wird der bestehende Tracker-Cockpit-Befehl genutzt;
frisches GPS dient bevorzugt als Start. Missions- und Revisionsschutz unveraendert.

Electron-Test mit Original-/Coherent-kompilierten Popup-Skripten bestanden:
Windrose bei 140px Widgetbreite quadratisch und sichtbar, SVG-Hoehe positiv,
Direct-To-Ziel/Name/GPS-Flag korrekt, Abbrechen sendet keinen Befehl.
EFB-Assetrevision 43301; Darstellung im MSFS-Popout bitte nachpruefen.

37 Webclient-/Cockpit-Tests bestanden. Windows-x64-PE und Version geprueft.

Asset: VFR-Multitool-Tracker.exe
Groesse: 57799761 Bytes
SHA-256: `c8d231d691dbeacc13fea3ba903f0cf17d644e1b3c8e9c58f957a3fc93ffb0dd`
