# Vertikale Luftraumwarnungen – lokale Rollout-Vorbereitung

Stand: 12.10.2026. Alpha-Release v518 und Desktop 1.6.14-alpha.1 sind veroeffentlicht;
Downloads und die 40 Alpha-Audioassets wurden verifiziert.
Release-Nachweis: `docs/Tracker-v518-Release.md`.

## Verhalten

- Nur innerhalb der horizontalen Luftraumflaeche und ausserhalb ihres vertikalen
  Bandes: Untergrenze oberhalb bzw. Obergrenze unterhalb des Flugzeugs.
- Erste Meldung bei maximal 1500 ft Abstand; weitere Naeherungsstufen bei
  1000, 500 und 100 ft. Die Stufen sind feste Grenzwerte, nicht 500 ft relativ
  zur zuerst angesagten Entfernung.
- Tatsächliche Entfernung auf volle 100 ft abrunden: 1160 ft werden 1100 ft.
  Beim erstmaligen Erkennen unter 100 ft: „weniger als hundert Fuß“.
- Pro Luftraum, Richtung und Stufe einmal; kein periodischer Replay beim
  Verbleiben im Warnbereich. Rearm erst oberhalb der jeweiligen Stufe +150 ft
  oder nach horizontalem Verlassen; Wiederholung fruehestens zwei Minuten nach
  der letzten Meldung dieser Stufe. Ein zu frueher Wiedereintritt wird
  unterdrueckt und nicht spaeter durch einen Timer nachgeholt.
- Spruenge ueber mehrere Stufen melden nur die tiefste aktuell erreichte Stufe.
  Bei mehreren Luftraeumen zuerst die kleinste Entfernung; die Zustände bleiben
  getrennt. Entfernen erzeugt keine neuen Entfernungsansagen.
- Neuere Stufen ersetzen aeltere wartende Ansagen desselben Luftraums und
  derselben Richtung. Wegflug, Bodenkontakt, Pause, deaktivierter Schalter oder
  fehlende aktuelle Hoehendaten stornieren ungueltige Ansagen. Nicht gestartete
  vertikale Jobs laufen nach zehn Sekunden ab.

## Hoehenreferenzen und Authority

MSL verwendet die Simulator-MSL-Hoehe. AGL verwendet die Gelaendehoehe unter
dem Flugzeug aus MSL minus AGL. Flight Levels werden gegen den optionalen
SimConnect-Wert `PRESSURE ALTITUDE` verglichen. Fehlende erforderliche Daten
werden nicht durch Null oder MSL als Druckhoehenersatz ersetzt; die betroffenen
Warnungen werden ausgelassen. Datenausfall rearmt keine bereits gemeldete Stufe.
Die bisherige OpenAIP-Klassifikation und Hoehenheuristik bleiben unveraendert.

Der neue Detektor laeuft im bestehenden Tracker-Warndienst, ohne offene Web-App
oder TTS-Key. Er bleibt auch bei Web-authoritativen Missionen Tracker-owned.
Die vorhandenen horizontalen Warnungen, Terrain- und Missions-Voice behalten
ihre bisherigen Authority-Gates. In diesem Fall darf der zusaetzliche
App-Playbackpfad ausschliesslich die vertikale Kategorie abspielen.

`ga.navigation-warnings.v1` bewirbt `capabilities.verticalAirspace` sowie
`verticalActive`. Der eigene Schalter `airspaceVertical` wird lokal und ueber
Audio-Settings gespeichert. App-/EFB- und Desktop-Menues sperren den neuen
Schalter bei Trackern ohne Capability. Die Kategorie nutzt die vorhandene
exklusive Playback-Lease und ausgewaehlte Audioausgabe.

## Sprachpakete

Anna (lokale macOS-Stimme), Matilda/Hannah/Liam (ElevenLabs Multilingual v2)
und Ava EN (bestehende lokale macOS-Stimme) verwenden die bisherige
Wortbaustein-Komposition. Pro Stimme liegen acht neue Clips vor: `aw-ein`,
`aw-zwei`, `aw-hundert`, `aw-tausend`, `aw-fuss`, `aw-oberhalb`, `aw-unterhalb`,
`aw-weniger-als`. Alle 40 Dateien wurden mit ffprobe und durch vollstaendiges
Decodieren geprueft.

Paula und Irene bleiben Experimente: vorhandene Hoerproben bleiben erhalten,
werden nicht in den Auswahlkatalog aufgenommen und gehoeren nicht in diesen
Rollout. Es wurden fuer diese Vorbereitung keine weiteren Clips fuer sie erzeugt.

## Ausrollen

1. Im gemischten Worktree den Release-Umfang explizit zusammenstellen. Die
   neuen Paula-/Irene-Proben und Zugangsdaten nicht mitveroeffentlichen.
2. Worker-Update fuer die additive Audio-Einstellung `airspaceVertical`
   bereitstellen, damit der Schalter geraeteuebergreifend erhalten bleibt.
3. App-Code und die 40 neuen Audioassets nach Alpha veroeffentlichen;
   `sw.js` Cache-Version vor dem Push erhoehen. Die Dateien muessen am vom
   Tracker verwendeten Alpha-Assetpfad abrufbar sein, bevor die Runtime live geht.
4. Tracker-Runtime versionieren, EXE neu bauen und als unveraenderlichen
   Alpha-Release bereitstellen; Desktop-UI/Player ebenfalls mit ausliefern.
   Generierte EFB- und Desktop-Assets synchron halten.
5. In MSFS Steigen unter einem C-Sektor, Sinken ueber einem Sektor, MSL/AGL/FL,
   Schalter, PC-/App-Ausgabe, unterbrochene Ansagen sowie Wiedereintritt vor/nach
   zwei Minuten testen. Dabei auch Betrieb ohne Web-App pruefen.
6. Erst nach Alpha-Feldtest nach den normalen Regeln promoten.

Worker deployed, Windows-EXE und separater Alpha-Desktop-Installer gebaut.
App-/Asset-Push und Release-Uploads sind abgeschlossen und verifiziert.
Der Runtime-Alpha-Zeiger bleibt auf dem neueren, ebenfalls verifizierten v519,
das die vertikalen Warnungen enthaelt. Desktop-Alpha zeigt separat auf 1.6.14-alpha.1. Build-/Push-Vertrag: `docs/github-push-workflow.md`.

## Lokale Nachweise

```bash
node --test navigation-warning-core.test.js navigation-warning-vertical.test.js ga-tracker-client/tracker-navigation-warnings.test.js ga-tracker-client/tracker-navigation-audio.test.js ga-tracker-client/tracker-audio-client.test.js ga-tracker-client/tracker-audio-player.test.js ga-tracker-client/tracker-audio-control-core.test.js ga-tracker-client/tracker-audio-menu-stability.test.js tools/cloudflare-worker/audio-settings.test.mjs
node tools/awm-audio-queue-selftest.mjs
```

Ein realer MSFS-/Windows-Playbacknachweis steht noch aus.

Lokaler Abschluss: 59 Tests aus den oben genannten Bereichen bestehen,
ebenso der AWM-Queue-Selbsttest und 16 Syntaxpruefungen. Der generierte
EFB-Browserkern laedt und stellt den vertikalen Detektor bereit. Die 40
Zusatzassets lassen sich vollstaendig decodieren.
