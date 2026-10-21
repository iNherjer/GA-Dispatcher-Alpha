# Tracker v583 Alpha / Web v2186 – Gepäckgruppen und Testflug-Funde EDTF→EDTW

Liefert die beiden offenen Einträge der Release-Warteschlange vom 21.10.2026 aus.

## Gepäckdarstellung über den Cargo-Composer

Rückflug vom 20.10.2026: Die Ausrüstung des Reporters erschien als zwei Kartons statt als
Kamera-Equipment. Ursache war die Stichwort-Zuordnung auf dem frei geschriebenen Label
plus ein generischer Akku-Karton.

- Reporter-, Charter- und Sightseeing-Gepäck: Ein Composer-Schritt (parallel zum Writer)
  ordnet die Beschreibung 1–3 Packstücken aus dem Cargo-Katalog zu. Größe und Variante
  wählt der Code nach Gewicht; Farbe/Modell werden gestreut. Ideen-Prompts bleiben ohne
  Katalog und ohne Beispiele.
- Dynamischer Katalog `data/mission-cargo-asset-profiles.json` (Form, Größe, Lastbereich,
  Verwendung je Pack-Asset), generiert nach `data/mission-cargo-assets.js`.
- Gruppen: ein Manifest-Posten, mehrere Stücke mit eigenem Objektschlüssel (`:p2`, `:p3`).
  Startszene, Pickup-Szene, Laden, Entladen und Abwurf behandeln alle Stücke gemeinsam.
  Tracker-Teil: `tracker-mission-simulator-effects.js`.
- Rückflug übernimmt die Auswahl des Hinflugs. Reporter: Zusatzposten „Akkukoffer und
  Speicherkarten“ entfällt. Ohne gültige Composer-Wahl bleibt die bisherige Zuordnung.

## Testflug-Funde EDTF→EDTW (Startfreigabe, PAX-Fragen, Ladung, Ankunftsplatzierung)

Siehe Eintrag in `docs/Release Queue.md`. In diesem Release zusätzlich eingecheckt: der
`tracker.js`-Teil (Spawn-Sperre für ungeprüfte Flughafen-Ersatzpunkte über `planSource`,
`hangarFront`-Kandidaten in `resolveAptArrivalLivePlacement`). Doku in
`docs/Arrival Scene Placement.md` und `docs/Tracker Mission Migration Guide.md`.

Tracker v583, Host-Assetrevision 58301, Web-Cache v2186. EFB-/Toolbar-Community-Paket und
Desktop-Installer unverändert. Nur Alpha-Runtime umstellen.

## Prüfung

- `node --test tools/mission-cargo-visual.test.mjs` (11), Gruppenfall in
  `tracker-mission-simulator-effects.test.js`, Cargo-/Szenen-/Ideen-Tests, Ankunftsszenen-Tests.
- Live-Check des Composers über den Produktionscode: 15 von 15 gültige Zuordnungen.
