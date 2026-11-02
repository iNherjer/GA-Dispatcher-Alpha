# Tracker v608 Alpha / Web v2308 / Desktop 1.6.33 – Vereinsflotte: „Belegt“ ab dem Live-Flug

Rückmeldung aus dem ersten Test (02.11.2026): Live-Flug mit DEINA am Boden, Crew-Brett zeigte „Frei“, weil
die Maschine erst beim Abheben belegt wurde. Gewünscht: belegt, sobald der Live-Flug erkannt ist.

## Änderungen

- Neuer Zustand `busy` („Belegt“) in `wili-fleet-core.js`: Tracker meldet `claim`, sobald der Live-Flug des
  Crew-Status mit dieser Maschine existiert (Mission auch am Boden; freier Flug ab dem Start), und `unclaim`,
  wenn der Flug ohne Start endet (z. B. Mission abgebrochen) → wieder frei. Start → In der Luft wie bisher.
- Worker: Events `claim`/`unclaim`; Konflikt am Boden heißt „genutzt“, nach Start „geflogen“.
  Erkennung toleranter (Lackierungs-Kennzeichen, Titelzusatz, Abstellplatz) – Worker 92e29440 bereits live.
- Crew-Brett: Chip „Belegt“ (violett), größerer Zettel. Desktop 1.6.33 blendet „Belegt“ bei anderen ebenfalls aus.
- `EFB_WEB_ASSET_REVISION` 60801.

Nur Alpha-Runtime umstellen, Stable unverändert.
