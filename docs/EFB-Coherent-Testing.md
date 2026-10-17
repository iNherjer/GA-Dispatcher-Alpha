# EFB-/Coherent-Testgrenzen

## Browser-Regressionen mit gezielt eingeschränkten Fähigkeiten

`tools/efb-photo-regression-ui-selftest.mjs` lädt die produktiven EFB-Assets und
entfernt für den Test CSS-Grid-, inset- und color-mix-Deklarationen. Pointer-
Capture wirft absichtlich einen Fehler; Maus und Touch werden separat geprüft.
Das sind Fehlerszenarien, kein Nachweis, dass jede MSFS-Version genau diese
Eigenschaften gleich behandelt. Verfügbarkeit und wirksames Rendering im
konkreten Simulator müssen gemessen werden.

Der Test prüft vier Breiten-/Skalierungsfälle, sichtbare anklickbare FIS-/Delta-
Höhenflächen, Pixelmaße, gespeicherte Toolpositionen, Zwei-Spalten-Aufbau und
Schrift-/Link-Kontrast. Screenshots ergänzen die Geometrieprüfungen. Die normalen
Original-/Coherent-Assettests bleiben daneben bestehen; ein funktionierender
Chrome-/Electron-Lauf allein beweist keine Simulatorverträglichkeit.

## Echte Coherent-Engine

GPU-Compositing, verlorene Paint-Flächen, native Schrift-/Texturfehler, VR-
Eingaben, Host-/iframe-Lifecycle und Rendering auf dem Cockpit-Display sind im
Browser nicht vollständig nachgebildet. Die Abnahme erfolgt deshalb weiterhin
im realen MSFS. Der nächste sinnvolle Diagnosepunkt ist ein im tatsächlichen
EFB gemessener Fähigkeits-/Geometrie-Snapshot, nicht nur CSS.supports(): auch
berechnete Maße und sichtbare Ebenen müssen stimmen.

Der MSFS-2024-SDK-Coherent-GT-Debugger verbindet sich mit dem laufenden Simulator
und erlaubt DOM-/CSS-/Netzwerkprüfung sowie temporäre Live-Änderungen. Das ist
die echte Engine, keine eigenständige Browseremulation.

Offizielle Anleitung:
https://docs.flightsimulator.com/msfs2024/html/6_Programming_APIs/JavaScript/Coherent_GT_Debugger.htm
