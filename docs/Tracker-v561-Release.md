# Tracker v561 Alpha – fotografierte EFB-Regressionen

- Folgen-Button wieder in der rechten unteren Kartenecke, 6 logische Pixel Rand.
- Verschiebbarer Tool-Button über Pointer, Maus und Touch, auch ohne nutzbares
  Pointer-Capture. Position bleibt gespeichert, Drag löst keinen Tool-Klick aus.
- Dunkle Flugplatz-Popups bleiben dunkel; helle Schrift, Frequenzwerte und
  AIP-Links erhalten passenden Kontrast. Gleiches gilt für die eingebettete
  Flugplatzanzeige im Kontextfenster. Helle Wetterkarten bleiben unverändert.
- „Was ist hier?“ mit EFB-Flexspalten und expliziten Pixelmaßen statt Abhängigkeit
  von CSS-Grid/min/max. Offene Fenster passen sich an logischen Viewport und
  Skalierung an. Höhenband und scrollbarere Details bleiben nebeneinander.
- Veraltete Timerreferenz beim EFB-Schließen entfernt; Observer-Cleanup bleibt.

Prüfungen: 36 betroffene Quell-/Asset-/Daten-/Font-Tests; neuer Browser-Fotofalltest
bei 838/440 Pixeln und 100/150 Prozent mit deaktiviertem Grid, nicht verfügbarem
Pointer-Capture, expliziten Maus-/Touch-Gesten und Text-/Link-Kontrast >= 4,5:1.
Original-/Coherent-Popup-Test einschließlich Wetter, Highlights, AIP, Rotation,
später Antworten und Fehlern/Retry bestanden. Screenshots visuell geprüft.
Realer MSFS-/VR-Feldtest bleibt erforderlich.

Windows-x64-EXE mit pkg/Node18 ohne Bytecode gebaut und PE-Architektur geprüft.
174008187 Bytes, SHA-256
`346889b1ace9411739a79067837517b56f5f18054c79d6eb9f1f453ba2a40038`.
EFB-Assetrevision 56101, Web-Cache v2140. Kein Community-Paket-/Worker-Update.
Veröffentlichung und Alpha-Aktivierung stehen noch aus.
