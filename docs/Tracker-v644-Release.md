# Tracker v644 Alpha – Rückflug-Rückblick nach der Landung

Zusammen ausgeliefert mit Web v2441 (18.11.2026).

## Anlass

Rückflug-Anfragen (Charter, Reporter) zeigten auf der Karte den Hinflug-Reisegrund, als stünde
der Aufenthalt noch bevor. Die Rückflug-Geschichte entstand erst beim Annehmen.

## Änderungen

- Web v2440 (`27322dfb8`, schon live): Karte zeigt ohne Geschichte einen festen Satz
  („Aufenthalt hinter sich, bittet um den Rückflug“); Infra-Befundtexte mit Umlauten.
- `mission-charter-continuation-core.js`: Die Rückflug-Geschichte liefert optional `offerText`
  (40–350 Zeichen, Rückblick der Disposition); die Karte zeigt ihn, sonst den festen Satz.
- Tracker: `finalizeExecutionRun` merkt Charter-/Reporter-Rückreisen ohne Geschichte in
  `followupRecapQueue` vor (nur mit Voice-Schlüssel, neustartfest, max. 16, 2 Tage).
  `tracker-mission-charter-recap.js` schreibt sie im Hintergrund (Prüfung alle 15 s, ein Auftrag
  pro Landung, eine Strukturkorrektur, Pause 2/4 min, max. 3 Versuche) und legt
  `recap:<id>` in den Folgeauftrags-Postausgang; der Cloud-Abgleich hängt die Geschichte an das
  offene Angebot. Logs `MISSION_FOLLOWUP_RECAP_WRITTEN` / `MISSION_FOLLOWUP_RECAP_FAILED`.
- Web v2441: Fehlt die Geschichte bei fälliger Karte, versucht die App sie einmal im
  Hintergrund (Vermerk `recapAttemptedAt` am Angebot, kein zweiter Versuch auf anderen Geräten).
  Beim Annehmen wird eine vorhandene Geschichte weiterverwendet.
- `EFB_WEB_ASSET_REVISION` 64401.

## Tests

- Alle Tracker-Testdateien einzeln grün; neu `tracker-mission-charter-recap.test.js` (inkl.
  Auftragskern im getrennten Prozess, voller Postausgang, ohne Schlüssel) und App-Rückfall in
  `tools/mission-followup-ui.test.mjs`. `tools/mission-completion-followup.test.cjs` bleibt wie
  vorher rot (Testausschnitt ohne `_missionExecutionAuthorityIsTracker`).
- Echter KI-Aufruf aus dem Tracker und MSFS noch nicht geprüft.

## Feldtest

- Charter mit Rückflug fliegen, Tracker nach der Landung laufen lassen: im Log
  `MISSION_FOLLOWUP_RECAP_WRITTEN ... card=1`; Karte zeigt später einen rückblickenden Text.
- Annehmen: Mission erzählt denselben Aufenthalt, keine Wartezeit für den Rückblick.

## Artefakt

- Tag `v644`, Asset `VFR-Multitool-Tracker.exe`
- Größe: 175182779 Bytes
- SHA-256: 59b00f87a29f493287ee653157e6beb8ae317feb8c83488432c469dd67856713 (öffentlicher Download geprüft)
