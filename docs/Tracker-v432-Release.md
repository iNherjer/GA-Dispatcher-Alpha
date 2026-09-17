# Tracker v432 Alpha – EFB-Kacheln und Zoomgrenzen

- Zoomwechsel stoppen jetzt auch per tileabort abgebrochene Kachelanfragen samt
  Ersatzserver-Timern. Unsichtbare Kacheln starten keine weiteren Fallbacks.
- Der vorhandene OpenTopo-Ersatzserver bleibt aktiv, mit denselben Wartezeiten
  wie in der Standalone-App. Der lokale Proxy bleibt die letzte Rueckfallebene.
- FAA-Overlay ab Zoom 8 wie Standalone; gesamte Karte maximal Zoom 18. Dadurch
  erlauben Dunkel/Hell keine Zoomstufen oberhalb der Overlay-Grenze.

33 Kachel-/Karten-/Proxy-Tests bestanden, einschliesslich Abbruch waehrend einer
Backup-Anfrage, spaeter Callbacks und anschliessender neuer Kachelanforderung.
EFB-Assetrevision 43201. Reale Serververfuegbarkeit und MSFS-Zoomverhalten sind
im Feld zu pruefen; keine Aenderung an Missionslogik oder Verladeverarbeitung.

Zusaetzlich 19 Webclient-Tests bestanden. Windows-x64-PE und Version geprueft.

Asset: VFR-Multitool-Tracker.exe
Groesse: 57798745 Bytes
SHA-256: `d8bc1f3a53a3fe0c7fc9e4d578ff48771af455474c83eb92f9ab6df3d64fbbc0`
