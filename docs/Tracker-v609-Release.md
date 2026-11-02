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

Nur Alpha-Runtime umstellen, Stable unverändert.
