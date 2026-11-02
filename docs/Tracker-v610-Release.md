# Tracker v610 Alpha / Web v2313 – Vereinsflotte: Erkennung über den Titel, Slew ist kein Flug

Fund aus dem Test (02.11.2026): Comanche abgestellt, in die Dakota gewechselt, kurzer Slew-Sprung, danach Export.
Die Comanche stand als „In der Luft · du“. Ursache: Der Slew-Sprung galt als Start der Dakota; die Dakota war
noch nicht in der Flotte, und die Erkennung nahm die einzige Maschine mit dem Kennzeichen „DEINA“ – die Comanche.

## Änderungen

- `matchAircraft` (Worker 02.11.2026): Der Titel muss immer passen. Kennzeichen oder Standort allein reichen nicht.
- Tracker: Während Slew aktiv ist, entstehen weder Start/Landung im Live-Flug noch Flotten-Events.
- `EFB_WEB_ASSET_REVISION` 61001.

Hängende Belegung aus dem Test: auf der Pinnwand „Freigeben“ oder sie endet beim Verlassen der Maschine.

Nur Alpha-Runtime umstellen, Stable unverändert.
