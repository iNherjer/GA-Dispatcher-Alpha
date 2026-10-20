# Tracker v571 Alpha / Web v2169 – Restlautstärke im Einstellungsfeld aktuell

Feldtest Desktop 1.6.25/1.6.27: Das Web-/EFB-Einstellungsfeld „Bei Ansagen leiser /
Restlautstärke“ zeigte einen alten Wert (10 %), während Desktop 20 % bzw. 35 % zeigte.
Ursache: Der Client holte den Medienstand nur bei geöffnetem Player (Winamp/iPod/Watch).

## Änderungen

- `media-player-client.js` (Web und EFB-Quelle): Ist der Player geschlossen, das
  Einstellungsfeld aber sichtbar, wird der Stand höchstens alle 3 s abgefragt. Die
  Restlautstärke, die die Desktop-App seit 1.6.25 zentral hält, erscheint so überall.
  Verborgenes Feld erzeugt keinen zusätzlichen Verkehr.
- Mitgeliefert: EFB-Kopie von `styles.css` mit dem bereits committeten
  Einklapp-Panel der Missionsanfragen (11b1bf587) synchronisiert.

Tracker v571, Host-Assetrevision 57101, Web-Cache v2169. EFB-/Toolbar-Community-Paket
und Desktop-Installer unverändert. Nur Alpha-Runtime umstellen.

## Prüfung

- 36 Medien-/EFB-Tests (neu: Abfrage bei geschlossenem Player, kein Verkehr bei
  verborgenem Feld, beide Client-Fassungen). Asset-Sync grün.
- Gesamtsuite `ga-tracker-client/*.test.js`: 1356 von 1391 bestanden; die 35
  Fehlschläge (Missions-/POI-/SAR-Bereich) bestehen ebenso auf dem unveränderten
  Stand (dort 37) – keine neuen Fehler.
- Windows-x64 mit pkg 6.18.1 / Node18, ARM-Cross-Build
  `--no-bytecode --public --public-packages '*'`. PE-x64, v571, Assetrevision 57101
  und eingebetteter Medien-Client geprüft.

EXE: 174144572 Bytes; SHA-256 `7cc8d1c9d248b4ecafb056b1381414580f48486ea62e1c956af7e2b783df587d`.
