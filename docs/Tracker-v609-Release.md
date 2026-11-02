# Tracker v609 Alpha / Desktop 1.6.35 / Web v2312 – Freigabe erst beim Verlassen, Positionen ohne Export

## Änderungen

- Regel (Wunsch nach Test 02.11.2026): Belegt, In der Luft und Gelandet enden erst, wenn der Pilot die
  Maschine verlässt; vorher könnte er weiterfliegen. Ein Mod-Export gibt nicht mehr frei.
- Tracker (`tracker-crew-presence.js`): Event `left` bei anderer Maschine, 60 s Hauptmenü/Weltkarte,
  getrennter Sim (`setAircraft(null)` beim SimConnect-Abbruch) und beim Beenden des Trackers. Der Claim bleibt
  nach Missionsabbruch bestehen; `unclaim` entfällt. Log `CREW_FLEET_LEFT`.
- Worker: `left` findet die Maschine über die aktive Belegung des Piloten; Upload ändert die Belegung nicht mehr.
- Desktop 1.6.35: neue Bodenpositionen aus `state.txt` gehen ohne Export hoch (nur Position, Dateizeit − 10 s);
  was der Mod schon so zeigt, wird nicht als Import vorbereitet.
- `EFB_WEB_ASSET_REVISION` 60901.

Tracker-EXE (Worktree `479201a8b`, `node_modules` verlinkt): 174733699 Bytes, SHA-256
`e2ca88202d6c5dc7df9a21cda36f88fb924e6be3764fd432eadb9bd66f94f4c4`. Desktop 1.6.35 (`node_modules` kopiert):
100309529 Bytes, SHA-512 wie `latest.yml`. Downloads geprüft. Tests: Tracker 1537/1539 (2 übersprungen),
Desktop 145/145, Worker vollständig. Worker 92fe0bbc deployt.

Alpha-Runtime auf v609, Stable unverändert. Desktop-Autoupdate 1.6.35 aktiviert.
