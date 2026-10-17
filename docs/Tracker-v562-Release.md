# Tracker v562 Alpha – Höhenband und schmaleres Kontextfenster

- EFB-Höhenband mit ausdrücklich gesetzten Kanten statt alleiniger inset-
  Positionierung für Himmel, Skala, Luftraumstack und Atmosphäre.
- Luftraumflächen mit einfachen RGBA-Farben statt color-mix-Abhängigkeit,
  einschließlich Auswahl/Hover. Höhenberechnung und Luftraumdaten unverändert.
- Kontext-Inhaltsbreite maximal 320 statt 440 logische Pixel; Höhenspalte
  einschließlich Rahmen 72 Pixel. Wetter-Widget im schmalen EFB untereinander.

Historie v558–v561: Bandberechnung unverändert; v561 änderte den EFB-Container
von Grid auf Flex. Der genaue native MSFS-Regressionsauslöser ist nicht bewiesen.

Prüfung: 28 betroffene Daten-/Assettests und bestehender Original-/Coherent-
Popup-Browsertest bestanden. Erweiterter Fotofalltest bei 838/440 Pixeln und
100/150 Prozent mit deaktiviertem Grid/inset/color-mix und fehlendem Pointer-
Capture: FIS GND–FL100 und Delta FL75–FL100 sichtbar, korrekt positioniert und
per echtem Klick auswählbar; kompakte Breite und Schriftkontrast geprüft.
Screenshot visuell kontrolliert. Reale MSFS-/VR-Abnahme weiterhin erforderlich.
Testgrenzen: [EFB-Coherent-Testing](EFB-Coherent-Testing.md).

Windows-x64-EXE mit pkg/Node18 ohne Bytecode gebaut, PE-Architektur geprüft.
174009894 Bytes, SHA-256
`ae590fb1719135aa8db7723516a3c168b6fd1cd5e50058a306ea640d4e1ea643`.
Assetrevision 56201, Web-Cache v2143. Kein Community-Paket-/Worker-Update nötig.
Release v562 veröffentlicht; öffentlicher Download größen- und SHA-256-gleich
verifiziert. Alpha auf v562 aktiviert; Stable unverändert.
