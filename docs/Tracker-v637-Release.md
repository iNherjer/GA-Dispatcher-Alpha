# Tracker v637 Alpha – Schwellen-Meldungen für Übelkeit und Ladungsschaden

Zusammen ausgeliefert mit Web v2400 (Cache). Keine Änderung an `tracker.js` außer der Version.

## Änderungen Tracker

- **Pax-Übelkeit:** Komfortwert unter 50 %: Dem Pax wird übel. Unter 30 %: Er braucht eine Spucktüte und möchte bald
  landen. Die Texte erzeugt das Textmodell aus der Pax-Persönlichkeit. Die Sprachausgabe bekommt eine eigene
  Sprechanweisung (gequält bzw. elend) als Gemini-`speech_metadata.style` bzw. OpenAI-`instructions`.
- **Ladungsschaden:** Der Live-Ladungszustand nutzt dieselbe Formel wie die Ankunftsprüfung. Bei ≤ 50 %: „wohl etwas kaputt“.
  Bei ≤ 35 % (bestehende Ausfallgrenze für Pflichtladung): „wirklich kaputt“, bei Pflichtladung mit dem Hinweis, dass
  das für den Auftrag ein echtes Problem ist.
- Jede Stufe kommt einmal pro Lauf, mit mindestens 20 s Abstand, und nicht gegen die drei bestehenden Komfort-Hinweise.
  Ohne Pax gibt es keine Stimme; das EFB zeigt „Ladung beschädigt“ / „Ladung kaputt“ mit dem Live-Wert (`cargoLive`).
- Neues Modul `tracker-mission-distress-voice-core.js`. Log `MISSION_DISTRESS_VOICE`. Vertrag in
  `docs/Mission Runtime Authority Contract.md` (14.11.2026).
- `EFB_WEB_ASSET_REVISION` 63701.

## Web v2400

- `passenger-voice.js` zeigt die neuen Meldungen (`pax_distress`, `cargo_distress`) im Pax-Fenster.
- `mission-boarding-voice-core.js`: `conversationalTtsStyle(speaker, override)`. Das optionale Argument ändert
  bestehende Aufrufe nicht.
- Die Mindestversion bleibt unverändert.

## Geprüft

- Tracker-Suite 1567/1569 (2 übersprungen, 0 Fehler), dazu ein Ende-zu-Ende-Test mit harten Manövern bis zu allen
  vier Meldungen und der EFB-Zeile.
- **Im Simulator und im MSFS-EFB noch nicht geprüft.**

Stable bleibt unverändert.

## Aktivierung

Release `v637` (Release-Commit `1f0340711`, gebaut im sauberen Worktree mit `--no-bytecode`),
`VFR-Multitool-Tracker.exe` 175103640 Bytes,
SHA-256 `eb77611ec6f25ee0d2925aaeb06096a256dc5d66a5402f3d6481d2719bdd87f0`,
öffentlicher Download geprüft. Alpha-Kanal aktiviert, Stable unverändert.
