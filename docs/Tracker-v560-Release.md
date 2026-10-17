# Tracker v560 Alpha – EFB-Handle, Modern-Flächen und Stift

- Oberer Menü-Handle als eigener Vordergrundknoten außerhalb des Karten-
  Scrollbereichs. Beide Hälften bleiben über der Karte sichtbar und bedienbar,
  auch nach eingeklapptem Neustart.
- Modern-Flächen im EFB mit deckenden dunklen Hintergründen für Glass-/Card-/
  Drawer-Flächen, Telemetrie, Zeichenmenü, Profil-/Audio-Menü und Leaflet-Popups.
  Andere Themes und die Web-App behalten ihr Design.
- Nur eine Begrenzung für den Stift im EFB, anhand der tatsächlichen Kartenmaße.
  Geöffnete Werkzeuge verschieben den Button nicht; die Leiste richtet sich
  nach dem freien Platz aus und scrollt dort. Relative Buttonposition bleibt
  über Skalierungs-/Größenwechsel erhalten. Alte gespeicherte Positionen bleiben
  lesbar, neue speichern zusätzlich die Kartenmaße.

39 Quell-/Asset-/Skalierungstests bestanden. Erweiterter Browsernachweis:
27 Kartenmenü-/Zentrieren-Zyklen, 9 Kombinationen aus EFB/Popout/Toolbar und
100/150/300 Prozent mit echten Stift-Drags, Öffnen am Rand, Skalierungswechseln,
vollständigen Handle-Hitflächen sowie Prüfung deckender Modern-Hintergründe.
Neustart mit eingeklappter Toolbar und NAVCOM-Wiederherstellung weiter geprüft.
Screenshot visuell kontrolliert; reale MSFS-/VR-Abnahme nach Installation offen.
Vorhandene Browserprüfung mit 60 Popout-/Toolbar-Layoutfällen ebenfalls bestanden.

Windows-x64-Artefakt mit pkg/Node18 ohne Bytecode gebaut und PE-Architektur
geprüft. Größe: 174002820 Bytes. SHA-256:
`bf725aecc85e1d8a20cdabcadb098af7bf5f469824148ca6277ac64866564be7`.
EFB-Assetrevision 56001. Kein Community-Paket-/Worker-Update erforderlich.
Release v560 veröffentlicht; öffentlicher Download größen- und SHA-256-gleich
verifiziert. Alpha auf v560 aktiviert, Web-Cache v2139; Stable unverändert.
