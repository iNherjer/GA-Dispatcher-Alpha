# Mission Audio Cue Assets

Dieses System ist optional: fehlt eine Datei, bleibt der Cue still. Neue Assets kommen in `audio-cues/`.

Varianten werden pro Mission und Cue stabil gewaehlt, nicht pro Event. Wenn also `photo1.mp3` fuer einen Flug gewaehlt wurde, nutzt ein ganzer Foto-Burst denselben Klicksound. Beim naechsten Flug kann eine andere Variante drankommen.

## Dateiregel

- Primaer: `audio-cues/<stem>.mp3`
- Varianten: `audio-cues/<stem>1.mp3` bis `audio-cues/<stem>8.mp3`
- Bindestrich- und Cue-ID-Schreibweise funktionieren beide: `cargo-load.mp3` und `cargo_load.mp3` werden gleich behandelt.
- Foto-Alias: `audio-cues/foto.mp3`, `audio-cues/foto1.mp3` usw. funktionieren ebenfalls.
- Foto-Legacy: `foto.mp3` im Projektroot bleibt als Fallback erhalten; auch `foto1.mp3` usw. im Root werden erkannt.
- `none` ist ein echter Cue-Wert und bedeutet: keinen Sound abspielen.

## Cue-Tabelle

| Cue ID | Bedeutung | Trigger / Einsatz | Primaere Datei | Varianten |
| --- | --- | --- | --- | --- |
| `none` | Kein Audio-Cue | Mission oder Event soll bewusst still bleiben | keine | keine |
| `photo` | Kameraausloeser / Foto-Burst | POI-Kettenpunkt dokumentiert, Sightseeing-Foto, Medienauftrag | `audio-cues/photo.mp3` | `photo1.mp3` ... `photo8.mp3`; Alias `foto1.mp3` ... `foto8.mp3`; Root-Fallback `foto.mp3` |
| `scan_start` | Scan beginnt / Sensor wird aktiv | Mapping-Survey beim Einflug in den Surveybereich | `audio-cues/scan-start.mp3` | `scan-start1.mp3` ... `scan-start8.mp3` |
| `scan_tick` | Laufender kurzer Scan-Impuls | Optional fuer spaetere Scan-Zwischenschritte | `audio-cues/scan-tick.mp3` | `scan-tick1.mp3` ... `scan-tick8.mp3` |
| `data_lock` | Datenpunkt gesichert | Mapping-Linie oder Orbit-Umlauf abgeschlossen | `audio-cues/data-lock.mp3` | `data-lock1.mp3` ... `data-lock8.mp3` |
| `point_mark` | Punkt markiert / Checkpoint bestaetigt | Generische Punkt- oder Kontrollmarker ohne Foto | `audio-cues/point-mark.mp3` | `point-mark1.mp3` ... `point-mark8.mp3` |
| `radio_blip` | Funk-/Comms-Klick | Funkartige Statusereignisse, spaeter nutzbar | `audio-cues/radio-blip.mp3` | `radio-blip1.mp3` ... `radio-blip8.mp3` |
| `handoff` | Uebergabe / Abschluss | Survey abgeschlossen, Passagier oder Unterlagen uebergeben | `audio-cues/handoff.mp3` | `handoff1.mp3` ... `handoff8.mp3` |
| `boarding_pax` | Passagier steigt ein, Gurtzeug, Schritte, Tuer | Parallel zur Boarding-Geschichte; Passenger load/unload fallback | `audio-cues/boarding-pax.mp3` oder `audio-cues/boarding_pax.mp3` | `boarding-pax1.mp3` / `boarding_pax1.mp3` ... `8` |
| `boarding_cargo` | Mehrere Frachtteile werden eingeladen | Auto-load / groesserer Ladeprozess | `audio-cues/boarding-cargo.mp3` oder `audio-cues/boarding_cargo.mp3` | `boarding-cargo1.mp3` / `boarding_cargo1.mp3` ... `8` |
| `cargo_load` | Einzelnes Cargo-Item wird geladen | Cargo Load Button, Wiederladen | `audio-cues/cargo-load.mp3` oder `audio-cues/cargo_load.mp3` | `cargo-load1.mp3` / `cargo_load1.mp3` ... `8` |
| `cargo_unload` | Einzelnes Cargo-Item wird entladen | Cargo Unload Button | `audio-cues/cargo-unload.mp3` oder `audio-cues/cargo_unload.mp3` | `cargo-unload1.mp3` / `cargo_unload1.mp3` ... `8` |
| `cargo_pickup` | Pickup-Fracht wird am Ziel aufgenommen | Pickup-Cargo am Zielstrip/Zielplatz | `audio-cues/cargo-pickup.mp3` oder `audio-cues/cargo_pickup.mp3` | `cargo-pickup1.mp3` / `cargo_pickup1.mp3` ... `8` |
| `cargo_drop` | Abwurf / harter Drop | Cargo im Flug abgeworfen | `audio-cues/cargo-drop.mp3` oder `audio-cues/cargo_drop.mp3` | `cargo-drop1.mp3` / `cargo_drop1.mp3` ... `8` |

## Aktuelle Default-Zuordnung

| Bereich | Event | Default Cue |
| --- | --- | --- |
| `poi_chain` | `point_complete` | `photo` |
| `mapping_survey` | `survey_area_entered` | `scan_start` |
| `mapping_survey` | `line_complete` | `data_lock` |
| `mapping_survey` | `orbit_turn_complete` | `data_lock` |
| `mapping_survey` | `survey_complete` | `handoff` |
| `boarding` | `start` | `boarding_pax` |
| `cargo` | `load` / `reload` | `cargo_load` |
| `cargo` | `pickup` | `cargo_pickup` |
| `cargo` | `unload` | `cargo_unload` |
| `cargo` | `drop` | `cargo_drop` |
| `cargo` | `auto_load` | `boarding_cargo` |
| `cargo` | `passenger_load` / `passenger_reload` | `boarding_pax` |
| `cargo` | `passenger_unload` | `handoff` |

## Mission-Overrides

Eine Mission kann Cues ueber `audioCues` ueberschreiben. Akzeptiert werden flache Schluessel oder verschachtelte Bereiche:

```js
audioCues: {
  'poi_chain.point_complete': 'photo',
  'mapping_survey.line_complete': 'none',
  cargo: {
    load: 'cargo_load',
    unload: 'cargo_unload'
  },
  boarding: {
    start: 'boarding_pax'
  }
}
```

Damit kann ein Sightseeing- oder Mediengast Fotos hoerbar machen, waehrend ein Lidar-/Mapping-Auftrag auf technische Scan-Cues oder `none` gestellt wird.

## Service Worker

Die Cue-Dateien werden zur Laufzeit gesucht. Solange die Asset-Liste noch waechst, muessen optionale Dateien nicht in `sw.js` stehen. Wenn ein festes Soundpaket shipped werden soll, koennen die finalen Dateien in den Service-Worker-Cache aufgenommen und die Cache-Version erhoeht werden.
