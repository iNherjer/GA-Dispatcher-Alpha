# Tracker v610 Alpha / Web v2313 – Vereinsflotte: Erkennung über den Titel, Slew ist kein Flug

Fund aus dem Test (02.11.2026): Comanche abgestellt, in die Dakota gewechselt, kurzer Slew-Sprung, danach Export.
Die Comanche stand als „In der Luft · du“. Ursache: Der Slew-Sprung galt als Start der Dakota; die Dakota war
noch nicht in der Flotte, und die Erkennung nahm die einzige Maschine mit dem Kennzeichen „DEINA“ – die Comanche.

## Änderungen

- `matchAircraft` (Worker 02.11.2026): Der Titel muss immer passen. Kennzeichen oder Standort allein reichen nicht.
- Tracker: Während Slew aktiv ist, entstehen weder Start/Landung im Live-Flug noch Flotten-Events.
- `EFB_WEB_ASSET_REVISION` 61001.

Hängende Belegung aus dem Test: auf der Pinnwand „Freigeben“ oder sie endet beim Verlassen der Maschine.

EXE (Worktree `ef98799a1`, `node_modules` verlinkt): 174734004 Bytes, SHA-256
`c25801985c652c2e510ce2d9b24291ff5839b08599efdd2ccc9f674c4f8515cb`, Download geprüft. Tests: Tracker 1537/1540
(2 übersprungen, 1 zeitabhängiger Audio-Test im Gesamtlauf, einzeln 3× grün), Desktop 145/145, Worker vollständig.
Worker 0bdc0c6a deployt.

Alpha-Runtime auf v610, Stable unverändert.
