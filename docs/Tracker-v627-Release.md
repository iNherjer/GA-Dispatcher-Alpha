# Tracker v627 Alpha – Befunde Testflug 09.11.2026 (Touch-and-go, Crew, Quest)

Zusammen ausgeliefert mit Web v2357 und einem Worker-Deploy.

## Tracker

- **Touch-and-go an fremdem Platz:** Die Passagieransage „gelandet, wir rollen zum
  Empfangspunkt“ startete bei jedem Aufsetzen und galt danach als verbraucht – am echten Ziel
  kam sie nicht mehr. Die Laufzeit liefert jetzt `touchdownAtDestination` (am Ziel oder
  ≤ 1,2 NM). Fremdes Aufsetzen löst die vorhandene Bemerkung „wo sind wir denn hier gelandet?“
  aus, die Landeansage kommt nur am Ziel. POI- und Trainingsmissionen unverändert.
- **Bemerkung zum fremden Platz einmal pro Platz:** Neue Bemerkung erst, wenn das Aufsetzen
  bzw. Stehen ≥ 10 NM von der letzten Bemerkung entfernt ist (bisher alle 90 s, solange man
  stand). Position im Stimmzustand und im Effekt (`lat`/`lon`), übersteht Neustarts.
- Missionsfortschritt war nie betroffen: Ankunft nur bei `GROUND_STILL` am Ziel.
- Generator `tools/generate-tracker-flight-voice-core.mjs` angepasst, Kern neu erzeugt.
- `EFB_WEB_ASSET_REVISION` 62701.

## Web (v2357)

- **Crew-Pinnwand:** Geteilte Flüge kamen nie in der Cloud an (keepalive-Upload > 64 KB
  scheiterte stumm). Crew-Flüge jetzt gzip-komprimiert (ca. 149 KB → 35 KB), Upload ohne
  keepalive mit Antwortprüfung, Meldung bei Fehler/voller Pinnwand, max. 3 geteilte Flüge pro
  Pilot, Crew-Flüge verfallen nach 30 Tagen.
- **Quest-Tastatur:** Flugplatzfelder melden `inputmode=text`/`enterkeyhint=done`; auf
  Touch-Geräten wird der Text erst kurz nach dem Fokus markiert.

## Worker

- Crew-Pinnwand (`/api/sync/GROUP_*`) bis 1 MiB, Profile weiter 256 KiB.
- **CrewPresence:** Die vom Tracker vor dem ersten Beat eines neuen Flugs hochgeladene Mission
  wurde beim Beat gelöscht – „Diesen Auftrag selbst fliegen“ fand nie einen Auftrag. Gelöscht
  wird nur noch eine Mission eines anderen Flugs.

## Geprüft

- Tracker 1545/1549 (2 übersprungen); 2 Zeit-Ausreißer im Volllauf
  (`tracker-mission-fire-integration`, `tracker-navigation-audio`), einzeln 3× grün und auf
  sauberem `origin/main` grün.
- Web 214/214, Worker 97/99 (2 Follow-up-Tests schon vorher rot, unabhängig).
- Neue Tests: Touch-and-go/Landeansage, Bemerkung pro Platz (10 NM), CrewPresence-Reihenfolge,
  Crew-Grenze 1 MiB.
- Im MSFS-EFB und auf der Quest noch nicht geprüft.

Stable bleibt unverändert (v605).

## Aktivierung

Tracker: Release `v627` (Release-Commit `912a116ed`, gebaut im sauberen Worktree mit
`--no-bytecode`), `VFR-Multitool-Tracker.exe` 175018610 Bytes,
SHA-256 `e3b09e5d404a7353293240c92923f039df494786ece49080b35227bc76b1c2f6`, öffentlicher Download geprüft.
`channel/alpha.json` aktiviert, `channel/stable.json` unverändert (v605).
Worker `ga-proxy` Version `797bfc8c-988d-4146-a8b0-7cf0952a5b74`.
