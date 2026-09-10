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

Coherent GT dokumentiert TTF-/OTF-Laden:
https://coherent-labs.com/Documentation/cpp-gt/dd/d09/font_usage.html
Die Emoji-Dokumentation neuerer Gameface-Versionen ist **kein** Nachweis für die
im MSFS verwendete Engine. Im Feldtest mit v400 blieben Zeichen trotz lokaler
COLRv0-Schrift unsichtbar.

Deshalb enthält `symbols.json` SVG-Pfadgrafiken der bestehenden Glyphen.
OpenMoji-Grafiken sind abgeleitete Werke unter CC BY-SA 4.0; Attribution siehe
oben und `OpenMoji-LICENSE.txt`. Änderungen: Export der COLR-Farblagen als
SVG-Pfade, Anpassung der ViewBox für Icon-Boxen. Noto-Symbole sind Kontur-Exporte
aus den oben genannten OFL-Schriften. Es werden keine Schriftdateien geändert.
Reproduzierbarer Build (nur Entwickler, Python mit FontTools 4.60.2):

```sh
python3 tools/build-efb-symbols.py
```

Der EFB-Adapter ersetzt Textsymbole in neu hinzugefügten HTML-Teilbäumen durch
lokale Bilder und bewahrt den Originaltext im DOM. Zusammengesetzte Emojis
werden als eine Grafik dargestellt. Der gemeinsame Profil-Renderer bleibt die
Quelle; nur seine EFB-Kompilierung zeichnet Icons per `drawImage`, einschließlich
gemischter Icon-/Text-Labels. Canvas-Schriftzuweisungen behalten die erste
App-Schriftfamilie, weil dort kein Font-Fallback-Stapel vorausgesetzt werden darf.
Nach dem Laden der Bilder wird das Profil erneut gezeichnet. Inline-/SVG-Text
nutzt weiterhin lokale Font-Fallbacks; SVG-Text und native Select-Optionen werden
nicht durch HTML-Bilder ersetzt.

Keine Netzwerk-Abhängigkeit zur Laufzeit, keine Veränderung an Missions- oder
Warnungslogik. Die tatsächliche MSFS-/Coherent-Darstellung bleibt Teil des
Feldtests; Electron allein beweist keine Simulator-Kompatibilität.
