# Tracker v563 Alpha – optionale Zieh-Zoomsteuerung

Im Anzeige-Menü ersetzt „Zoomsteuerung“ optional die Plus-/Minus-Tasten und
den separaten Follow-Schalter. Eine dezente Lupe am linken Kartenrand steuert
per vertikalem Abstand die Zoomgeschwindigkeit mit 20 Layoutpixeln Ruhezone.
Loslassen/Abbruch stoppt sofort. Antippen schaltet Follow mit Autozoom ein bzw.
Follow aus; aktives Follow zeigt einen hellblauen Standortpfeil. Die Auswahl
bleibt im Browser bzw. über den bestehenden EFB-Settings-Pfad gespeichert.

Manuelles Ziehen deaktiviert Autozoom explizit, beendet dessen Timer und laufende
Animationen und erhält Follow. Fractional Zoom bleibt beim erneuten Berühren und
bei Follow-Pans erhalten. Vorhandene Kartenkacheln bleiben während des Zoomens
sichtbar; der Abschluss gibt Tile-Pruning wieder frei.

Gemeinsames Modul für Web/EFB, für Coherent kompiliert. Pointer, Maus und Touch
mit Window-Completion ohne erforderliches Pointer-Capture, Skalierung aus den
wirklichen Control-Maßen und Unterdrückung synthetischer Maus-Doppeleingaben.
Kein neues Community-Package, keine neue Shell-/Missionsnachricht erforderlich.

Basis: frisch bestätigtes origin/main `7a4fe7408`. 30 betroffene Asset-,
Coherent-Syntax- und Einstellungstests sowie Web-Browserregression bestanden.
EFB-Browsermatrix bei 100/150/300 Prozent prüft alle Eingabearten, Tile-Erhalt,
Geschwindigkeit/Richtung, Deadzone, Tap/Drag, Follow-Indikator, Autozoom-Übergabe,
Abbrüche, Ersatz der alten Controls und Persistenz. Reale MSFS-/Coherent-/VR-
Abnahme bleibt Alpha-Feldtest; Browsernachweise ersetzen sie nicht.

Windows-x64-EXE mit pkg/Node18 ohne Bytecode gebaut, PE-Architektur und fünf
vollständige eingebettete EFB-Assets bytegenau geprüft. Größe 174023633 Bytes,
SHA-256 `eecd0d935bb0f2c14cf7e5fbadc23fed05721f3495ee208434f726d98b3fc616`.
Assetrevision 56301, Web-Cache v2148. Veröffentlichung und Alpha-Aktivierung
folgen nach öffentlicher Download-/Hash-Prüfung; Stable bleibt unverändert.
