# Desktop 1.6.43 Alpha – Renderfenster beim Kartenwechsel schließen

- Mit Tracker v657 schließt das MapLibre-Fenster nach dem letzten Renderauftrag,
  wenn alle aktiven Cockpit-Ansichten eine andere Basiskarte gewählt haben.
- Die normale Leerlaufzeit beträgt zehn Minuten. Der Leerlauf-Timer pausiert
  bei einem laufenden Auftrag. Fertige JPEG-Kacheln bleiben im Cache.
- Der Alpha-Installer ist für den manuellen Feldtest vorgesehen.

## Tests

Desktop-Suite mit 155 bestandenen und drei übersprungenen Tests.

## Im Feld prüfen

Unter Windows den Installer ausführen, Tracker Alpha auswählen und in MSFS
den Wechsel von der Vektorkarte auf eine andere Basiskarte prüfen.

## Artefakt

- [Alpha-Release](https://github.com/iNherjer/GA-Dispatcher-Alpha/releases/tag/tracker-desktop-v1.6.43)
  aus Commit `4dad33ba3`. NSIS-Installer für Windows x64 mit 100567263 Bytes.
- SHA-256 `10971d8d4441f638ac48523833fb943d1080145454e67d354178c513c8226c41`.
- Öffentliche Downloads von Installer, Blockmap und Update-Metadaten bytegenau
  geprüft. Der manuelle Download ist für den Alpha-Feldtest verfügbar.
- Installation und Laufzeit auf Windows stehen als Feldtest aus.
