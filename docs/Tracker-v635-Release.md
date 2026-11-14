# Tracker v635 Alpha – Aufräumen geschlossener Missionen, Composer-Diagnose

Zusammen ausgeliefert mit Web v2391 (Cache).

## Änderungen Tracker

- **Geschlossene Mission räumt ihre Szenen ab:** Löscht die Cloud eine bereits geschlossene
  Mission (Debriefing geschlossen), entfernt der Tracker vor dem Zurücksetzen des Missionsstands
  alle Szenen dieser Mission (`clearClosedMissionScenes` → `clearAuthorityRunEffects`).
  Feldtest 13.11.2026: ausgeladene Lieferung und Vereinsgepäck blieben am Ziel stehen, weil nur
  ein aktiver Run abgeräumt wurde. Eine laufende Mission wird nie angefasst. Log:
  `MISSION_CLOSED_SCENES_CLEARED`.
- **Composer-Diagnose:** Beim Laden einer Mission (`MISSION_CLOUD_ACTIVATE`) schreibt der Tracker
  `GROUND_COMPOSER` (Status `ai`/`fallback`, Quelle, Idee, Looks je Pax, Packstücke, Fehler; ohne
  Plan der Grund, z. B. `no-ai`, `disabled`) und `GROUND_COMPOSER_MANIFEST` (Figuren und
  Packstücke, die die Ladeliste tatsächlich nutzt). Modul `tracker-ground-composer-log.js`.
- `EFB_WEB_ASSET_REVISION` 63501.
- Mitgeliefert aus der Release Queue: Folgeanfragen tragen `groundCarry` (`mission-followup.js`),
  Privat-Rückflug-Kern (`mission-private-return-core.js`, `mission-cargo-visual-core.js`),
  EFB-Kopien `i18n/en.js` und `profile.js` (ohne Wirkung im Tracker).

## Web (gleichzeitig)

- Der Composer vermerkt im Plan sein Ergebnis (`groundVisual.composer`), der allgemeine Schritt
  den Grund, wenn er nicht lief (`groundComposerStatus`).
- Die Mindestversion bleibt unverändert.

## Geprüft

- Tracker-Suite 1563/1565 (2 übersprungen, 0 Fehler), Web-Tests einzeln grün.
- **Im Simulator und im MSFS-EFB noch nicht geprüft.**

Stable bleibt unverändert.
