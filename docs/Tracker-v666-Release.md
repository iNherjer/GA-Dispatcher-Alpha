# Tracker v666 Alpha – Wetter-Diagnose im Log

Der Tracker liefert EFB-Webassets mit Revision 66601. Der zugehörige Web-Cache ist v2566. Nur Diagnose:
Passagier, Mission und Anzeige bleiben unverändert.

Anlass: Orti flog am 26.11.2026 im Nebel. Der Sim meldete `AMBIENT VISIBILITY` 138,6 km, die
Passagier-Bausteine machen daraus „Sicht 138.6 km (ausgezeichnet)“, und der Passagier lobte die Fernsicht.

- **`SIM_WEATHER`** jede Minute bei Mission oder in der Luft, sofort bei Wechsel von Sichtband
  (<1/3/5/8/20/50 km), Wolke oder Niederschlag (höchstens alle 10 s). Felder:
  - Sicht roh in Metern, in Wolken, Niederschlag (Zustand, Bezeichnung, Rate), Temperatur, Wind, Böen, Turbulenz
  - Höhe, Höhe über Grund, Boden, Position (2 Stellen), Wetter-Preset aus dem EFB, Mission
  - neu aus dem Sim: `qnh` (SEA LEVEL PRESSURE), `pressInHg` (AMBIENT PRESSURE), `density` (AMBIENT DENSITY),
    `tat` (TOTAL AIR TEMPERATURE), `ice` (STRUCTURAL ICE PCT), `windVert` (AMBIENT WIND Y)
  - `voiceHint`: die Sichtzeile, die die Passagier-Prompts bauen
- **Zusatzwerte isoliert:** Jeder neue Wert hat eine eigene Datendefinition (IDs 230–235, einmal pro Sekunde). Kennt
  der Sim einen Wert nicht, steht er als `?` im Log und einmal `SIM_WEATHER_EXTRA_ERROR`. Das Haupt-Datenpaket
  bleibt unverändert. MSFS dokumentiert keinen Wert für Nebel, Luftfeuchte oder Taupunkt.
- **`SIM_WEATHER_METAR`** alle 10 min: nächstes METAR (aviationweather.gov, Ausschnitt ±0,6°/±0,9° um das
  Flugzeug) mit Station, Abstand, Sicht, Wettererscheinung (z. B. FG, BR), Flugkategorie,
  Temperatur/Taupunkt-Spread und Roh-METAR.
- **`VOICE_TEXT`**: die ersten 300 Zeichen jedes gesprochenen Textes.

## Im Simulator prüfen

- Flug mit Live-Wetter bei Nebel oder Dunst und ein Flug mit Nebel-Preset. Im Log `SIM_WEATHER visM=… cloud=…`
  gegen `SIM_WEATHER_METAR … wx=… spread=…` und `VOICE_TEXT` legen.
- Ob `SIM_WEATHER_EXTRA_ERROR` auftaucht (Wert vom Sim nicht geliefert).

## Tests

- Tracker-Gesamtlauf: 1651 bestanden, 2 übersprungen, 0 Fehler (neu: `tracker-weather-diagnostics.test.js`,
  `tracker-weather-extra-telemetry.test.js`). METAR-Abruf live geprüft.

## Artefakt

- [Tracker v666 Alpha](https://github.com/iNherjer/GA-Dispatcher-Alpha/releases/tag/v666)
  aus Commit `RELEASE_COMMIT`. Windows-x64-EXE mit EXE_SIZE Bytes.
- SHA-256 `EXE_SHA`.
- Öffentlicher Download bytegenau geprüft. Aktivierung im Tracker-Alpha-Kanal.
