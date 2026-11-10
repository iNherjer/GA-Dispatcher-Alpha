# Tracker v629 Alpha – Preset-Symbol im EFB, eigenes Flugzeug per Objekt-ID

Zusammen ausgeliefert mit Web v2359.

## Tracker

- **Eigenes Flugzeug per SimConnect-Objekt-ID:** v628 prüfte die Objekt-ID 1; das eigene
  Flugzeug hat aber eine konkrete, wechselnde ID (z. B. 540672). Der Tracker liest sie jetzt aus
  der Haupt-Telemetrie (`recv.objectID`) und filtert damit den Verkehr. Rückfall weiter gleiche
  Position (≈ 30 m) und Höhe (< 100 ft). `TRAFFIC_SNAPSHOT own=<id>` im Debug-Log.
- **Preset-Symbol im EFB:** Neues Modul `tracker-aircraft-icons.js` liest das Profilfeld
  `aircraftPresets` (höchstens einmal pro Minute, offline letzter Stand) und stellt es unter
  `/api/v1/aircraft-icons` (nur Loopback) bereit. Der EFB-Host setzt
  `window.gaActivePlaneIconProfile`: bei laufender Mission das Manifest-Flugzeug
  (`aircraftSlot`), sonst die Auswahl im Hauptmenü (`_library.selected`). Ohne eigenes
  Preset-Symbol (`icon.custom`) bleibt das globale EFB-Symbol.
- `EFB_WEB_ASSET_REVISION` 62901.

## Web (v2359)

- Die Flugzeugwahl im Hauptmenü wird als `aircraftPresets._library.selected` gespeichert und
  bei einem Wechsel mit der Cloud abgeglichen. Ältere Clients ignorieren das Feld.

## Geprüft

- Tracker 1549/1553 bzw. 1547–1549 je Lauf (2 übersprungen); wechselnde Zeit-Ausreißer in
  Missions-Integrationstests (Feuer, SAR, Navigationsansagen) im Volllauf, einzeln alle grün.
- Web 215/215.
- Neue Tests: `tracker-aircraft-icons.test.js`, Symbolwahl im EFB-Host.
- Browser: Flugzeugwechsel schreibt `_library.selected`. Im MSFS-EFB noch nicht geprüft.

Stable bleibt unverändert (v605).

## Aktivierung

_wird nach dem Build ergänzt_
