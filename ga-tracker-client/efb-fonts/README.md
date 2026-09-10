# Lokale EFB-Schriften

Diese unveränderten TTF-Dateien werden in der Tracker-EXE gebündelt und nur über
Loopback ausgeliefert. Versionierte Quellen stehen in `sources.json`.

- Noto Sans, Noto Sans Mono, Noto Sans Symbols 2, Noto Sans Math: Noto Project Authors,
  SIL Open Font License 1.1, siehe `Noto-LICENSE.txt`.
- OpenMoji 16.0.0: OpenMoji contributors, Hochschule für Gestaltung Schwäbisch
  Gmünd, https://openmoji.org/, CC BY-SA 4.0, siehe `OpenMoji-LICENSE.txt`.
  Die Originalschrift ist `OpenMoji-color-glyf_colr_0.ttf` (COLR Version 0).
- DSEG7 Classic Bold 0.46.0, Caveat SemiBold (600), Oleo Script (400/700),
  Share Tech Mono: Original-App-Schriften, jeweils SIL Open Font License 1.1.
  Die zugehörigen Lizenzdateien liegen ebenfalls hier. MS33558 bleibt die
  bereits gebündelte Originaldatei im Repository-Stamm.

Alle Dateien sind statische TrueType-Schriften. Caveat 600 kommt aus dem
versionierten Google-Fonts-Legacy-Endpunkt in `sources.json`: Die originale
TTF wurde verlustfrei aus dessen unkomprimiertem EOT-Container entnommen
(`EOTSize == response.length`, `Flags == 0`, letzte `FontDataSize` Bytes).
Es wurden weder Glyphen noch Namen oder Gewichte verändert. Die übrigen
Dateien sind unveränderte Downloads. Die EFB-Auslieferung entfernt die
Google-Fonts-Imports des gemeinsamen Stylesheets und ersetzt ausschließlich
die entfernte DSEG-WOFF2-Quelle durch dieselbe Version als lokale TTF.

Coherent dokumentiert TTF-/OTF-Laden und Font-Fallback pro Zeichen:
https://docs.coherent-labs.com/cpp-gameface/content_development/fonts_frontend/
Für farbige Emojis wird COLRv0 benötigt:
https://blog.coherent-labs.com/blog/news/emoji-support/

`tracker-efb-fonts.js` ergänzt ausschließlich die EFB-Darstellung um diese
Fallbacks. Vorhandene namentliche App-/Instrumentenschriften bleiben vorn.
Generische Monospace-Stapel erhalten eine lokale Monospace-Alternative.
Leerzeichen und normaler Text kommen aus Textfonts, nicht aus der Emoji-Schrift.
Zusammengesetzte ZWJ-Emojis erhalten eine gemeinsame Font-Zuweisung; ihre
Textinhalte bleiben unverändert. Für die Canvas-Labels wird derselbe Fallback
beim Kompilieren der gemeinsamen `profile.js` ergänzt. Dynamische Inline-
und SVG-Schriftstapel werden auf hinzugefügten DOM-Teilbäumen ergänzt, auch im
eigenen E6B-iframe. Es gibt keinen DOM-Gesamtscan pro Telemetrieupdate.

Keine Netzwerk-Abhängigkeit zur Laufzeit, keine Veränderung an Missions- oder
Warnungslogik. Die tatsächliche MSFS-/Coherent-Darstellung bleibt Teil des
Feldtests; Electron allein beweist keine Simulator-Kompatibilität.
