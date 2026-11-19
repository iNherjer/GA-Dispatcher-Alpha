# Tracker v652 Alpha – geteilter Crew-Auftrag bis 1 MiB

Quelle: Commit `aab31cb10` (19.11.2026). Worker ga-proxy deployed vorab (Version `757af9ba`).

## Änderungen

- `tracker-crew-presence.js`: Der Auftrag des laufenden Missionsflugs („Diesen Auftrag selbst fliegen“ auf dem
  Crew-Brett) wird bis 1000 KB gepackt hochgeladen (vorher 60 KB, roh bis 8 MB statt 2 MB). Aktuelle Aufträge sind
  gepackt 85–130 KB groß und wurden bisher mit `CREW_PRESENCE_MISSION_SKIPPED` übersprungen.
- Worker `crew-presence.mjs`: nimmt geteilte Aufträge bis 1 MiB an (wie die Crew-Pinnwand `GROUP_`), Test ergänzt.
- Web v2470: Meldung „kein Auftrag“ nennt die tatsächliche Ursache (Upload beim Missionsstart, größere Aufträge ab
  v652, freie Flüge ohne Auftrag); VFR-Index-Cache gepackt (nur Web).
- `EFB_WEB_ASSET_REVISION` 65201.

## Artefakt

Release-Commit `2b74235a1`, Tag `v652`, EXE 175334444 Bytes, SHA-256
`9f28ec3903b492072b0d48f473f9b5410164e5ef5851d1d7b8d045561687b6dd` (öffentlicher Download geprüft).

## Tests

Tracker-Suite: 1616/1618 bestanden, 2 übersprungen, 0 Fehler. Worker `crew-presence.test.mjs` 15/15.

## Im Feld prüfen (noch nicht geprüft)

- Missionsflug starten: im Log `CREW_PRESENCE_MISSION id=… bytes=…` statt `CREW_PRESENCE_MISSION_SKIPPED`.
- Ein anderes Crew-Mitglied öffnet den Flug auf dem Crew-Brett und lädt ihn mit „Selbst fliegen“.
- Piloten mit älterem Tracker teilen große Aufträge weiterhin nicht (Meldung weist auf v652 hin).
