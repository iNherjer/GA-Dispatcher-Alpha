# Tracker v518 Alpha – vertikale Luftraumwarnungen

Die neue vertikale Warnung meldet Luftraeume oberhalb und unterhalb des Flugzeugs
bei 1500/1000/500/100 ft Abstand. Entfernungen werden auf volle 100 ft abgerundet.
150-ft-Hysterese und zwei Minuten Cooldown verhindern Wiederholungen bei
gleichbleibendem Abstand. Ein separater Audio-Schalter steuert die Kategorie.

Die Berechnung laeuft im Tracker, auch ohne Web-App und waehrend Web-gefuehrter
Missionen. MSL, AGL und Flight Levels verwenden ihre passende Hoehenreferenz.
Veraltete Audiojobs werden storniert. Anna, Matilda, Hannah, Liam und Ava EN
besitzen die benoetigten Wortclips; Paula und Irene bleiben zurueckgestellt.

## Auslieferung

- Tracker-Runtime: v518, Windows x64.
- Desktop: 1.6.14-alpha.1, separater Alpha-Installer mit eigenem Menueschalter.
  Bestehende Stable-Desktop-Autoupdates bleiben auf ihrem bisherigen Kanal.
- Web-/EFB-Ausgabe: gemeinsamer Audio-Schalter, Capability fuer kompatible
  Tracker; Service-Worker-Cache v2017, EFB-Assetrevision 51801.
- Worker-Audio-Settings deployed: 3cce6ef8-5156-4867-998a-e29eb66ef385.

## Validierung

83 Warnungs-/Audio-/Worker-Tests und 54 Desktop-Tests bestehen auf dem aktuellen
Origin-Stand. Der gesamte Worker-Testlauf und der AWM-Queue-Selbsttest bestehen.
40 neue Sprachassets wurden vollstaendig decodiert. Windows-PE-x64 und
eingebettete v518-/Warnungsquellen sind geprueft. Der Tracker wurde mit dem
bestehenden Apple-Silicon-Cross-Build ohne Bytecode gebaut.

Ein Windows-/MSFS-Feldtest ist noch offen; dies ist ein Alpha-Release.
Release-Downloads und Kanalumschaltung werden nach dem Upload verifiziert.
