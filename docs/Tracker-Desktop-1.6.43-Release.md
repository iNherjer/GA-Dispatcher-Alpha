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
